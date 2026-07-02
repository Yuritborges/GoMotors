/**
 * Importação completa das planilhas Go Motors → Neon/Postgres
 * Uso: npm run db:import
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/create-prisma";
import {
  canonicalService,
  cleanModelName,
  clientDisplayName,
  inferVehicleType,
  mapExpenseCategory,
  mapPayment,
  normalizePlate,
  parseAmount,
  parseExcelDate,
  serviceCategory,
} from "./import-utils";

const prisma = createPrismaClient();
const DADOS = path.join(process.cwd(), "dados");

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
};

type VehicleSeed = {
  plate: string;
  model: string;
  vehicleType: ReturnType<typeof inferVehicleType>;
  clientName: string;
  partner?: string;
};

function readSheet(file: string, sheet: string) {
  const wb = XLSX.readFile(path.join(DADOS, file), { cellDates: true });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], {
    defval: null,
    raw: false,
  });
}

function readRotativo(): RotativoRow[] {
  const wb = XLSX.readFile(path.join(DADOS, "ROTATIVO 2026.xlsx"), { cellDates: true });
  const rows: RotativoRow[] = [];

  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[0]) continue;
      const date = parseExcelDate(r[0]);
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

function readLojas(): RotativoRow[] {
  const wb = XLSX.readFile(path.join(DADOS, "LOJAS 2026.xlsx"), { cellDates: true });
  const rows: RotativoRow[] = [];

  for (const sheet of wb.SheetNames) {
    const partner = sheet.trim();
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[0]) continue;
      const date = parseExcelDate(r[0]);
      const model = cleanModelName(r[1]);
      const plate = normalizePlate(r[2]);
      const serviceRaw = String(r[3] ?? "").trim();
      const amount = parseAmount(r[4]);
      if (!date || !serviceRaw) continue;
      rows.push({
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
      });
    }
  }
  return rows;
}

function readGastos(): { date: Date; description: string; amount: number }[] {
  const wb = XLSX.readFile(path.join(DADOS, "GASTOS LAVA RAPIDO 2026.xlsx"), {
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

function readEmployees(): string[] {
  const wb = XLSX.readFile(path.join(DADOS, "COLABORADORES (1).xlsx"), { cellDates: true });
  const names: string[] = [];

  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    let name = sheet.trim();
    for (const r of data.slice(0, 10)) {
      if (!r?.[0]) continue;
      const label = String(r[0]).toUpperCase();
      if (label.includes("FUNCION")) {
        name = String(r[1] ?? name).trim() || name;
        break;
      }
    }
    names.push(name);
  }
  return [...new Set(names)];
}

function orderKey(r: RotativoRow) {
  return `${r.date.toISOString().slice(0, 10)}|${r.plate ?? ""}|${r.serviceRaw}|${r.amount}`;
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

async function clearDatabase() {
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.serviceVehiclePrice.deleteMany();
  await prisma.service.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.client.deleteMany();
  await prisma.employeeTransaction.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  if (!fs.existsSync(DADOS)) {
    throw new Error(`Pasta não encontrada: ${DADOS}`);
  }

  console.log("Lendo planilhas...");
  const rotativo = readRotativo();
  const lojas = readLojas();
  const gastos = readGastos();
  const employeeNames = readEmployees();

  const rotativoKeys = new Set(rotativo.map(orderKey));
  const lojasDeduped = lojas.filter((r) => !rotativoKeys.has(orderKey(r)));
  const allOrders = [...rotativo, ...lojasDeduped];

  console.log(`ROTATIVO: ${rotativo.length} | LOJAS (extras): ${lojasDeduped.length}`);
  console.log(`GASTOS: ${gastos.length} | FUNCIONÁRIOS: ${employeeNames.length}`);

  const vehicleMap = buildVehicleMap(allOrders);
  console.log(`Veículos únicos: ${vehicleMap.size}`);

  console.log("Limpando banco...");
  await clearDatabase();

  console.log("Criando usuários Go Motors...");
  const ownerPassword = await bcrypt.hash("admin123", 12);
  const attendantPassword = await bcrypt.hash("atendente123", 12);
  await prisma.user.createMany({
    data: [
      {
        name: "Matheus — Go Motors",
        email: "admin@gomotors.local",
        passwordHash: ownerPassword,
        role: "PROPRIETARIO",
      },
      {
        name: "Atendente Go Motors",
        email: "atendente@gomotors.local",
        passwordHash: attendantPassword,
        role: "ATENDENTE",
      },
    ],
  });

  console.log("Criando funcionários...");
  const employees = await Promise.all(
    employeeNames.map((name) => prisma.employee.create({ data: { name, active: true } }))
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
        notes: v.partner ? `Parceiro: ${v.partner}` : null,
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
    // Histórico da planilha = serviço já realizado; conta como receita
    const paid = total > 0;

    await prisma.serviceOrder.create({
      data: {
        clientId,
        vehicleId,
        status: "ENTREGUE",
        subtotal: total,
        total,
        discount: 0,
        paymentMethod: row.payment,
        paymentStatus: paid ? "PAGO" : "PENDENTE",
        notes:
          row.isPartner
            ? `Loja parceira: ${row.paymentRaw} (${row.source})`
            : row.payment === "PENDENTE" && row.paymentRaw
              ? `Ref: ${row.paymentRaw} (${row.source})`
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
        payments: paid
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
