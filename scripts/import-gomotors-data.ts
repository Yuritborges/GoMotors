/**
 * Importação completa das planilhas Go Motors → Neon/Postgres
 * Uso: npm run db:import  (pode rodar de qualquer pasta)
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/create-prisma";
import { TEAM_EMPLOYEES } from "../src/lib/constants";
import { resolveSeedPassword } from "../src/lib/seed-passwords";
import {
  canonicalService,
  cleanModelName,
  clientDisplayName,
  inferVehicleType,
  isTeamValeExpense,
  mapExpenseCategory,
  mapPayment,
  matchEmployeeFromVale,
  normalizePlate,
  parseAmount,
  parseExcelDate,
  parseRotativoDate,
  resolveImportPaymentStatus,
  serviceCategory,
} from "./import-utils";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const DADOS = path.join(PROJECT_ROOT, "dados");

const DATA_FILE_ALIASES: Record<string, string[]> = {
  rotativo: ["ROTATIVO 2026.xlsx", "ROTATIVO 2026 (1).xlsx"],
  lojas: ["LOJAS 2026.xlsx", "LOJAS 2026 (1).xlsx"],
  gastos: ["GASTOS LAVA RAPIDO 2026.xlsx", "GASTOS LAVA RAPIDO 2026 (1).xlsx"],
  colaboradores: [
    "COLABORADORES 2026.xlsx",
    "COLABORADORES.xlsx",
    "COLABORADORES (2).xlsx",
  ],
};

function resolveDataFile(key: keyof typeof DATA_FILE_ALIASES): string {
  const aliases = DATA_FILE_ALIASES[key];
  for (const name of aliases) {
    const full = path.join(DADOS, name);
    if (fs.existsSync(full)) return full;
  }

  const files = fs.existsSync(DADOS)
    ? fs.readdirSync(DADOS).filter((f) => f.toLowerCase().endsWith(".xlsx"))
    : [];
  const token = key === "gastos" ? "GASTOS" : key === "colaboradores" ? "COLABORADORES" : key.toUpperCase();
  const fuzzy = files.find((f) => f.toUpperCase().includes(token));
  if (fuzzy) return path.join(DADOS, fuzzy);

  throw new Error(
    `Planilha obrigatória ausente: dados/${aliases[0]} (ou similar com "${token}" no nome)`
  );
}

const prisma = createPrismaClient();

function assertDatabaseConfigured() {
  const url = process.env.DATABASE_URL ?? "";
  const looksLikePlaceholder =
    !url ||
    url.includes("USER:PASSWORD") ||
    url.includes("@ep-xxx") ||
    url.includes("ep-xxx");

  if (looksLikePlaceholder) {
    console.error(`
[import] DATABASE_URL não está configurada no .env da raiz do projeto.

O arquivo ${path.join(PROJECT_ROOT, ".env")} ainda tem valores de exemplo.

Como corrigir:
  1. Abra https://console.neon.tech → projeto Go Motors → Connection string
  2. Copie a URL com "-pooler" → DATABASE_URL
  3. Copie a URL direta (sem pooler) → DIRECT_URL
  4. Cole no .env (substitua USER:PASSWORD@ep-xxx)

Ou copie de https://vercel.com → projeto → Settings → Environment Variables

Depois rode:
  cd ${PROJECT_ROOT}
  npm run db:import
`);
    process.exit(1);
  }
}

type RotativoRow = {
  date: Date;
  model: string;
  plate: string | null;
  serviceRaw: string;
  service: string;
  amount: number;
  paymentRaw: string;
  payment: ReturnType<typeof mapPayment>;
  source: string;
  isPartner?: boolean;
  partnerName?: string;
  /** Bloco da planilha LOJAS já quitado (subtotal verde). */
  partnerPaid?: boolean;
};

type VehicleSeed = {
  plate: string;
  model: string;
  vehicleType: ReturnType<typeof inferVehicleType>;
  clientName: string;
  partner?: string;
};

function readSheet(filePath: string, sheet: string) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], {
    defval: null,
    raw: false,
  });
}

function readRotativo(): RotativoRow[] {
  const wb = XLSX.readFile(resolveDataFile("rotativo"), { cellDates: true });
  const rows: RotativoRow[] = [];

  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[0]) continue;
      const date = parseRotativoDate(r[0], sheet);
      const model = cleanModelName(r[1]);
      const plate = normalizePlate(r[2]);
      const serviceRaw = String(r[3] ?? "").trim();
      const amount = parseAmount(r[4]);
      const paymentRaw = String(r[5] ?? "").trim();
      if (!date || !serviceRaw) continue;
      rows.push({
        date,
        model,
        plate,
        serviceRaw,
        service: canonicalService(serviceRaw),
        amount,
        paymentRaw,
        payment: mapPayment(paymentRaw),
        source: `ROTATIVO/${sheet}`,
      });
    }
  }
  return rows;
}

function isManualLedgerPartner(name: string): boolean {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return n.includes("MAGRAO");
}

function lojasDataStartRow(data: (string | number | Date | null)[][]): number {
  const first = data[0];
  if (!first) return 1;
  if (parseExcelDate(first[0]) && String(first[3] ?? "").trim()) return 0;
  return 1;
}

function readLojas(): RotativoRow[] {
  const wb = XLSX.readFile(resolveDataFile("lojas"), { cellDates: true });
  const rows: RotativoRow[] = [];

  for (const sheet of wb.SheetNames) {
    const partner = sheet.trim();
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    const startRow = lojasDataStartRow(data);
    const manualPartner = isManualLedgerPartner(partner);

    type Wash = { row: RotativoRow };
    let block: Wash[] = [];
    let hadClosedBlock = false;

    function isEmptyRow(r: (string | number | Date | null)[]) {
      const serviceRaw = String(r[3] ?? "").trim();
      const amount = parseAmount(r[4]);
      if (serviceRaw || amount > 0) return false;
      const extras = [r[5], r[6], r[7], r[8], r[9]].some((c) => String(c ?? "").trim());
      return !extras;
    }

    function flushBlock(closed: boolean) {
      if (block.length === 0) return;
      if (closed) hadClosedBlock = true;

      const onlyLastPending =
        !closed && hadClosedBlock && block.length > 1 && block.length <= 4;

      for (let i = 0; i < block.length; i++) {
        const { row } = block[i]!;
        const paid = manualPartner
          ? true
          : closed || (onlyLastPending && i < block.length - 1);
        row.partnerPaid = paid;
        row.payment = paid ? "PIX" : "PENDENTE";
        rows.push(row);
      }
      block = [];
    }

    for (let i = startRow; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      const date = parseExcelDate(r[0]);
      const serviceRaw = String(r[3] ?? "").trim();
      const amount = parseAmount(r[4]);

      if (date && serviceRaw) {
        const model = cleanModelName(r[1]);
        const plate = normalizePlate(r[2]);
        block.push({
          row: {
            date,
            model,
            plate,
            serviceRaw,
            service: canonicalService(serviceRaw),
            amount,
            paymentRaw: partner,
            payment: "PENDENTE",
            source: `LOJAS/${partner}`,
            isPartner: true,
            partnerName: partner,
          },
        });
        continue;
      }

      if (isEmptyRow(r)) {
        flushBlock(true);
        continue;
      }

      if (!serviceRaw && amount > 0) {
        flushBlock(true);
      }
    }

    flushBlock(false);
  }

  return rows;
}

function summarizeOpenPartnerWashes(lojas: RotativoRow[]): Map<string, number> {
  const open = new Map<string, number>();
  for (const row of lojas) {
    if (!row.partnerName || row.partnerPaid) continue;
    open.set(row.partnerName, (open.get(row.partnerName) ?? 0) + row.amount);
  }
  return open;
}

function readGastos(): { date: Date; description: string; amount: number }[] {
  const wb = XLSX.readFile(resolveDataFile("gastos"), {
    cellDates: true,
  });
  const rows: { date: Date; description: string; amount: number }[] = [];

  function pushRow(dateRaw: unknown, descRaw: unknown, amountRaw: unknown) {
    const date = parseExcelDate(dateRaw);
    const description = String(descRaw ?? "").trim();
    const amount = parseAmount(amountRaw);
    if (!date || !description || amount <= 0) return;
    const upper = description.toUpperCase();
    if (upper === "COMPRA" || upper === "PRODUTO" || upper === "DATA") return;
    rows.push({ date, description, amount });
  }

  function detectRightBlockStart(headerRow: unknown[]): number {
    for (let c = 1; c < headerRow.length; c++) {
      const prev = String(headerRow[c - 1] ?? "").toUpperCase();
      const cur = String(headerRow[c] ?? "").toUpperCase();
      if (prev.includes("DATA") && cur.includes("PRODUTO")) return c - 1;
    }
    return 8;
  }

  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    const rightStart = detectRightBlockStart(data[0] ?? []);
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      pushRow(r[0], r[1], r[2]);
      if (r.length > rightStart + 2) {
        pushRow(r[rightStart], r[rightStart + 1], r[rightStart + 2]);
      }
    }
  }
  return rows;
}

function extractAmountFromText(text: string): number {
  const br = text.match(/R\$\s*([\d.,]+)/i);
  if (br) return parseAmount(br[0]);
  const nums = text.match(/\d{2,5}/g);
  if (nums?.length) return parseAmount(nums[nums.length - 1]);
  return 0;
}

function inferPartnerEntryType(description: string, installment: string | null): "DIVIDA" | "PRODUTO" | "PARCELA" | "PAGAMENTO" | "AJUSTE" {
  const u = description.toUpperCase();
  if (u.includes("PAGUEI") || u.includes("PAGAMENTO") || u.includes("SOMA") && u.includes("PAG")) {
    return "PAGAMENTO";
  }
  if (installment || /\d+\s*(DE|\/)\s*\d+/i.test(description)) return "PARCELA";
  if (
    u.includes("PRODUTO") ||
    u.includes("FELTRO") ||
    u.includes("ESPUM") ||
    u.includes("FAIXA") ||
    u.includes("VOLANTE") ||
    u.includes("COIFA") ||
    u.includes("BOLA") ||
    u.includes("IPHONE") ||
    u.includes("EXTRATORA")
  ) {
    return u.includes("PG") || installment ? "PARCELA" : "PRODUTO";
  }
  if (u.includes("FALTA") || u.includes("RECEBER") || u.includes("DEVO") || u.includes("DIVIDA")) {
    return "DIVIDA";
  }
  return "DIVIDA";
}

function readPartnerLedger(openPartners: Set<string>): {
  partnerName: string;
  date: Date;
  type: "DIVIDA" | "PRODUTO" | "PARCELA" | "PAGAMENTO" | "AJUSTE";
  amount: number;
  description: string;
  installment: string | null;
}[] {
  const wb = XLSX.readFile(resolveDataFile("lojas"), { cellDates: true });
  const rows: ReturnType<typeof readPartnerLedger> = [];

  for (const sheet of wb.SheetNames) {
    const partnerName = sheet.trim();
    if (isManualLedgerPartner(partnerName)) continue;

    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;

      const serviceRaw = String(r[3] ?? "").trim();
      const hasWash = Boolean(parseExcelDate(r[0]) && serviceRaw);
      const col6 = String(r[6] ?? "").trim();
      const col7 = String(r[7] ?? "").trim();
      const col8 = String(r[8] ?? "").trim();
      const installment = r[9] ? String(r[9]).trim() : null;

      if (hasWash && col6 && !col7 && !col8) {
        const washAmount = parseAmount(r[4]);
        const noteAmount = extractAmountFromText(col6);
        const col6IsOnlyWashPrice =
          noteAmount > 0 &&
          Math.abs(noteAmount - washAmount) < 0.01 &&
          /^R?\$?\s*[\d.,]+$/.test(col6.replace(/\s/g, ""));
        const isProductNote = /faixa|volante|feltro|espum|coifa|bola|motorista/i.test(col6);
        if (!col6IsOnlyWashPrice && isProductNote && noteAmount > 0) {
          const type = inferPartnerEntryType(col6, installment);
          rows.push({
            partnerName,
            date: parseExcelDate(r[0]) ?? new Date(2026, 0, 15),
            type,
            amount: noteAmount,
            description: col6.slice(0, 300),
            installment,
          });
        }
        continue;
      }

      if (hasWash) continue;

      const label = [col6, col7, col8]
        .filter((part) => part && !part.toUpperCase().includes("DÍVIDAS E CART"))
        .join(" · ")
        .trim();
      if (!label) continue;

      const description = [label, installment].filter(Boolean).join(" · ").slice(0, 300);
      let amount =
        parseAmount(col8) ||
        parseAmount(col7) ||
        (!hasWash ? parseAmount(r[4]) : 0) ||
        extractAmountFromText(description);
      if (amount <= 0) amount = extractAmountFromText(col8) || extractAmountFromText(label);
      if (amount <= 0) continue;

      const date = parseExcelDate(r[0]) ?? new Date(2026, 0, 15);
      const type = inferPartnerEntryType(description, installment);
      const isDebit = type === "DIVIDA" || type === "PRODUTO" || type === "AJUSTE";
      if (isDebit && !openPartners.has(partnerName)) continue;
      rows.push({ partnerName, date, type, amount, description, installment });
    }
  }

  return rows;
}

function readColaboradoresSalaries(): Map<string, number> {
  const salaries = new Map<string, number>();
  let file: string;
  try {
    file = resolveDataFile("colaboradores");
  } catch {
    return salaries;
  }

  const wb = XLSX.readFile(file, { cellDates: true });
  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[sheet], {
      header: 1,
      defval: null,
      raw: false,
    });
    for (const row of data) {
      const label = String(row?.[0] ?? "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (label.includes("SALARIO MENSAL")) {
        const amount = parseAmount(row?.[1]);
        if (amount > 0) {
          salaries.set(sheet.trim().toUpperCase(), amount);
        }
        break;
      }
    }
  }
  return salaries;
}

function resolveEmployeeSalary(name: string, salaries: Map<string, number>): number {
  const upper = name.toUpperCase();
  for (const [key, amount] of salaries.entries()) {
    const k = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const n = upper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (k.includes(n) || n.includes(k.split(" ")[0] ?? "")) return amount;
  }
  return 0;
}

function orderKey(r: RotativoRow) {
  return `${r.date.toISOString().slice(0, 10)}|${r.plate ?? ""}|${r.serviceRaw}|${r.amount}`;
}

function buildPartnerOrderKeyMap(lojas: RotativoRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of lojas) {
    if (!row.partnerName) continue;
    map.set(orderKey(row), row.partnerName);
  }
  return map;
}

function buildPartnerPaidByKey(lojas: RotativoRow[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const row of lojas) {
    map.set(orderKey(row), row.partnerPaid ?? false);
  }
  return map;
}

function buildVehicleMap(allRows: RotativoRow[]): Map<string, VehicleSeed> {
  const map = new Map<string, VehicleSeed>();

  for (const row of allRows) {
    if (!row.plate) continue;
    const existing = map.get(row.plate);
    const model = row.model || existing?.model || "";
    const clientName = clientDisplayName(model, row.plate);
    const partner = row.source.startsWith("LOJAS/")
      ? row.source.replace("LOJAS/", "")
      : existing?.partner;

    if (!existing) {
      map.set(row.plate, {
        plate: row.plate,
        model,
        vehicleType: inferVehicleType(model),
        clientName,
        partner,
      });
    } else if (model && !existing.model) {
      existing.model = model;
      existing.clientName = clientDisplayName(model, row.plate);
      existing.vehicleType = inferVehicleType(model);
    }
  }

  // Placas sem cadastro: agrupa por modelo fictício
  let anon = 0;
  for (const row of allRows) {
    if (row.plate) continue;
    anon += 1;
    const pseudo = `SEMPLACA${anon}`;
    map.set(pseudo, {
      plate: pseudo,
      model: row.model || "Veículo avulso",
      vehicleType: inferVehicleType(row.model),
      clientName: row.model ? clientDisplayName(row.model, pseudo) : `Avulso #${anon}`,
    });
    row.plate = pseudo;
  }

  return map;
}

async function backupUsers() {
  try {
    return await prisma.user.findMany({
      select: { email: true, passwordHash: true, name: true, role: true },
    });
  } catch {
    return [];
  }
}

async function clearDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.serviceVehiclePrice.deleteMany();
  await prisma.service.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.client.deleteMany();
  await prisma.partnerLedgerEntry.deleteMany();
  await prisma.partnerStore.deleteMany();
  await prisma.employeeTransaction.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  assertDatabaseConfigured();

  if (!fs.existsSync(DADOS)) {
    throw new Error(`Pasta não encontrada: ${DADOS}`);
  }

  for (const key of ["rotativo", "lojas", "gastos"] as const) {
    resolveDataFile(key);
  }

  console.log("Planilhas encontradas:");
  console.log(`  ROTATIVO → ${path.basename(resolveDataFile("rotativo"))}`);
  console.log(`  LOJAS → ${path.basename(resolveDataFile("lojas"))}`);
  console.log(`  GASTOS → ${path.basename(resolveDataFile("gastos"))}`);
  try {
    console.log(`  COLABORADORES → ${path.basename(resolveDataFile("colaboradores"))}`);
  } catch {
    console.log("  COLABORADORES → (opcional, não encontrada)");
  }

  console.log("Lendo planilhas...");
  const rotativo = readRotativo();
  const lojas = readLojas();
  const openPartnerStores = new Set(summarizeOpenPartnerWashes(lojas).keys());
  const gastosAll = readGastos();
  const employeeVales = gastosAll.filter((g) => matchEmployeeFromVale(g.description));
  const gastos = gastosAll.filter((g) => !isTeamValeExpense(g.description));
  const partnerLedger = readPartnerLedger(openPartnerStores);
  const colaboradoresSalaries = readColaboradoresSalaries();
  const employeeNames = [...TEAM_EMPLOYEES];
  const partnerOrderKeys = buildPartnerOrderKeyMap(lojas);
  const partnerPaidByKey = buildPartnerPaidByKey(lojas);

  const rotativoKeys = new Set(rotativo.map(orderKey));
  const lojasDeduped = lojas.filter((r) => !rotativoKeys.has(orderKey(r)));
  const allOrders = [...rotativo, ...lojasDeduped];

  for (const row of allOrders) {
    const key = orderKey(row);
    if (!row.partnerName) {
      const partnerName = partnerOrderKeys.get(key);
      if (partnerName) row.partnerName = partnerName;
    }
    if (partnerPaidByKey.has(key)) {
      const paid = partnerPaidByKey.get(key)!;
      row.partnerPaid = paid;
      if (paid) row.payment = "PIX";
    }
  }

  console.log(`ROTATIVO: ${rotativo.length} | LOJAS (extras): ${lojasDeduped.length}`);
  console.log(
    `Vínculo loja↔rotativo: ${allOrders.filter((r) => r.partnerName).length} ordens`
  );
  console.log(
    `GASTOS: ${gastos.length} (+ ${employeeVales.length} vales → funcionários) | FUNCIONÁRIOS: ${employeeNames.length}`
  );
  console.log(`LANÇAMENTOS LOJAS: ${partnerLedger.length}`);
  const openWashes = summarizeOpenPartnerWashes(lojas);
  if (openWashes.size > 0) {
    console.log("Saldo lavagens (planilha, exc. Magrão manual):");
    for (const [name, total] of [...openWashes.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      console.log(`  ${name}: R$ ${total.toFixed(2)}`);
    }
  }
  if ([...lojas].some((r) => r.partnerName && isManualLedgerPartner(r.partnerName))) {
    console.log("  MAGRÃO: lavagens históricas importadas — saldo manual no sistema");
  }

  const vehicleMap = buildVehicleMap(allOrders);
  console.log(`Veículos únicos: ${vehicleMap.size}`);

  const userBackup = await backupUsers();
  if (userBackup.length > 0) {
    console.log(`Preservando senhas de ${userBackup.length} usuário(s) existente(s).`);
  }

  console.log("Limpando banco...");
  await clearDatabase();

  console.log("Criando usuários Go Motors...");
  const ownerPassword = await bcrypt.hash(
    resolveSeedPassword("SEED_OWNER_PASSWORD", "Administrador"),
    12
  );
  const attendantPassword = await bcrypt.hash(
    resolveSeedPassword("SEED_ATTENDANT_PASSWORD", "Atendente"),
    12
  );

  const defaultUsers = [
    {
      name: "Matheus — Go Motors",
      email: "matheuspoli@gomotors.local",
      passwordHash: ownerPassword,
      role: "PROPRIETARIO" as const,
    },
    {
      name: "Atendente Go Motors",
      email: "atendente@gomotors.local",
      passwordHash: attendantPassword,
      role: "ATENDENTE" as const,
    },
  ];

  for (const user of defaultUsers) {
    const backup = userBackup.find((u) => u.email === user.email);
    await prisma.user.create({
      data: backup
        ? {
            name: backup.name,
            email: backup.email,
            passwordHash: backup.passwordHash,
            role: backup.role,
          }
        : user,
    });
  }

  for (const backup of userBackup) {
    if (defaultUsers.some((u) => u.email === backup.email)) continue;
    await prisma.user.create({ data: backup });
  }

  console.log("Criando funcionários...");
  const employees = await Promise.all(
    employeeNames.map((name) =>
      prisma.employee.create({
        data: {
          name,
          active: true,
          salary: resolveEmployeeSalary(name, colaboradoresSalaries),
        },
      })
    )
  );

  console.log("Criando catálogo de serviços...");
  const priceSamples = new Map<string, number[]>();
  for (const row of allOrders) {
    const list = priceSamples.get(row.service) ?? [];
    if (row.amount > 0) list.push(row.amount);
    priceSamples.set(row.service, list);
  }

  const median = (arr: number[]) => {
    if (!arr.length) return 60;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 60;
  };

  const defaultCatalog = [
    "Lavagem simples",
    "Lavagem completa",
    "Lavagem de chassi",
    "Lavagem de motor",
    "Higienização",
    "Polimento",
    "Ducha",
    "Enceramento",
    "Detalhamento interno",
    "Serviços adicionais",
  ];

  const serviceIds = new Map<string, string>();
  const allServiceNames = new Set([...defaultCatalog, ...priceSamples.keys()]);

  const multipliers: Record<string, number> = {
    MOTO: 0.85,
    CARRO: 1,
    SUV: 1.15,
    CAMINHONETE: 1.25,
    OUTRO: 1,
  };

  for (const name of allServiceNames) {
    const samples = priceSamples.get(name) ?? [];
    const defaultPrice = median(samples.length ? samples : [60]);
    const service = await prisma.service.create({
      data: {
        name,
        category: serviceCategory(name),
        defaultPrice,
        estimatedMinutes: name.includes("Higien") ? 120 : name.includes("Completa") ? 45 : 30,
        active: true,
      },
    });
    serviceIds.set(name, service.id);
    for (const [vehicleType, mult] of Object.entries(multipliers)) {
      await prisma.serviceVehiclePrice.create({
        data: {
          serviceId: service.id,
          vehicleType: vehicleType as "MOTO" | "CARRO" | "SUV" | "CAMINHONETE" | "OUTRO",
          price: Math.round(defaultPrice * mult * 100) / 100,
        },
      });
    }
  }

  console.log("Criando clientes e veículos...");
  const plateToVehicleId = new Map<string, string>();
  const plateToClientId = new Map<string, string>();

  for (const v of vehicleMap.values()) {
    const client = await prisma.client.create({
      data: {
        name: v.clientName,
        phone: "—",
        notes: v.partner ? `PARCEIRO: ${v.partner}` : null,
        vehicles: {
          create: {
            plate: v.plate,
            brand: null,
            model: v.model || null,
            vehicleType: v.vehicleType,
          },
        },
      },
      include: { vehicles: true },
    });
    plateToVehicleId.set(v.plate, client.vehicles[0].id);
    plateToClientId.set(v.plate, client.id);
  }

  console.log("Criando lojas parceiras...");
  const partnerIds = new Map<string, string>();
  const lojasWb = XLSX.readFile(resolveDataFile("lojas"), { cellDates: true });
  for (const sheet of lojasWb.SheetNames) {
    const name = sheet.trim();
    const store = await prisma.partnerStore.create({ data: { name, active: true } });
    partnerIds.set(name, store.id);
  }

  console.log("Importando lançamentos das lojas (dívidas)...");
  for (const entry of partnerLedger) {
    const storeId = partnerIds.get(entry.partnerName);
    if (!storeId) continue;
    await prisma.partnerLedgerEntry.create({
      data: {
        partnerStoreId: storeId,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        installment: entry.installment,
        date: entry.date,
      },
    });
  }

  // Vales da equipe são lançados em /funcionarios (não reimportar da planilha GASTOS).
  if (employeeVales.length > 0) {
    console.log(
      `Vales da equipe (${employeeVales.length}) ignorados — use /funcionarios ou npm run db:reset-employee-cycles`
    );
  }

  console.log("Importando despesas...");
  for (const g of gastos) {
    await prisma.expense.create({
      data: {
        category: mapExpenseCategory(g.description),
        description: g.description.slice(0, 200),
        amount: g.amount,
        date: g.date,
      },
    });
  }

  console.log("Importando histórico de ordens...");
  let imported = 0;

  for (const row of allOrders) {
    const plate = row.plate!;
    const vehicleId = plateToVehicleId.get(plate)!;
    const clientId = plateToClientId.get(plate)!;
    const serviceId = serviceIds.get(row.service);
    const total = row.amount > 0 ? row.amount : 0;
    const isPartnerOrder = Boolean(row.isPartner || row.partnerName);
    const paymentStatus = resolveImportPaymentStatus({
      isPartner: isPartnerOrder,
      partnerPaid: row.partnerPaid,
      payment: row.payment,
      amount: total,
    });
    const isPaid = paymentStatus === "PAGO";
    const partnerStoreId = row.partnerName
      ? partnerIds.get(row.partnerName.trim())
      : undefined;

    await prisma.serviceOrder.create({
      data: {
        clientId,
        vehicleId,
        partnerStoreId: partnerStoreId ?? null,
        status: "ENTREGUE",
        subtotal: total,
        total,
        discount: 0,
        paymentMethod: row.payment,
        paymentStatus,
        notes:
          isPartnerOrder
            ? `LOJA PARCEIRA: ${row.paymentRaw} (${row.source})`
            : row.payment === "PENDENTE" && row.paymentRaw
              ? `REF: ${row.paymentRaw} (${row.source})`
              : row.source,
        entryAt: row.date,
        deliveredAt: row.date,
        items: {
          create: {
            serviceId: serviceId ?? null,
            serviceName: row.serviceRaw,
            price: total,
          },
        },
        payments: isPaid
          ? {
              create: {
                method: row.payment,
                amount: total,
                type: "PAGAMENTO",
                notes: row.paymentRaw || null,
              },
            }
          : undefined,
      },
    });

    imported += 1;
    if (imported % 50 === 0) {
      process.stdout.write(`\r  ${imported}/${allOrders.length}`);
    }
  }
  console.log("\n");

  await prisma.product.createMany({
    data: [
      { name: "Cera líquida", category: "Produtos", price: 45, stock: 15, minStock: 5 },
      { name: "Aromatizante", category: "Produtos", price: 25, stock: 20, minStock: 5 },
      { name: "Shampoo automotivo 5L", category: "Insumos", price: 89.9, stock: 8, minStock: 3 },
    ],
  });

  console.log("Importação concluída!");
  console.log({
    clientes: vehicleMap.size,
    ordens: allOrders.length,
    despesas: gastos.length,
    funcionarios: employees.length,
    servicos: serviceIds.size,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
