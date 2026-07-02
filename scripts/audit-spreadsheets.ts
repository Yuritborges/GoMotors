/**
 * Auditoria: planilhas vs o que o importador captura hoje
 * Uso: npx tsx scripts/audit-spreadsheets.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { createPrismaClient } from "../src/lib/create-prisma";
import {
  parseAmount,
  parseExcelDate,
  matchEmployeeFromVale,
} from "./import-utils";

const DADOS = path.join(process.cwd(), "dados");
const prisma = createPrismaClient();

function readGastosExpected() {
  const wb = XLSX.readFile(path.join(DADOS, "GASTOS LAVA RAPIDO 2026.xlsx"), { cellDates: true });
  const rows: { date: Date; description: string; amount: number; sheet: string }[] = [];

  function pushRow(sheet: string, dateRaw: unknown, descRaw: unknown, amountRaw: unknown) {
    const date = parseExcelDate(dateRaw);
    const description = String(descRaw ?? "").trim();
    const amount = parseAmount(amountRaw);
    if (!date || !description || amount <= 0) return;
    const upper = description.toUpperCase();
    if (upper === "COMPRA" || upper === "PRODUTO" || upper === "DATA") return;
    rows.push({ date, description, amount, sheet });
  }

  function detectRightStart(headerRow: unknown[]): number {
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
    const rightStart = detectRightStart(data[0] ?? []);
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      pushRow(sheet, r[0], r[1], r[2]);
      if (r.length > rightStart + 2) {
        pushRow(sheet, r[rightStart], r[rightStart + 1], r[rightStart + 2]);
      }
    }
  }
  return rows;
}

function readPartnerLedgerExpected() {
  const wb = XLSX.readFile(path.join(DADOS, "LOJAS 2026.xlsx"), { cellDates: true });
  const rows: { partner: string; description: string; amount: number }[] = [];

  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      const label = String(r[7] ?? "").trim();
      if (!label || label.toUpperCase().includes("DÍVIDAS E CART")) continue;
      const extra = String(r[8] ?? "").trim();
      const description = [label, extra].filter(Boolean).join(" · ");
      let amount = parseAmount(r[4]) || parseAmount(r[8]);
      if (amount <= 0) {
        const m = description.match(/R\$\s*([\d.,]+)/i) || description.match(/\b(\d{2,5})\b/);
        if (m) amount = parseAmount(m[0]);
      }
      if (amount <= 0) continue;
      rows.push({ partner: sheet.trim(), description, amount });
    }
  }
  return rows;
}

function readValeMentions() {
  const wb = XLSX.readFile(path.join(DADOS, "GASTOS LAVA RAPIDO 2026.xlsx"), { cellDates: true });
  const vales: { date: Date; description: string; amount: number; sheet: string }[] = [];

  for (const sheet of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      wb.Sheets[sheet],
      { header: 1, defval: null, raw: false }
    );
    const rightStart = 8;
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      for (const [d, desc, amt] of [
        [r[0], r[1], r[2]],
        [r[rightStart], r[rightStart + 1], r[rightStart + 2]],
      ] as const) {
        const description = String(desc ?? "").trim();
        if (!/vale/i.test(description)) continue;
        const date = parseExcelDate(d);
        const amount = parseAmount(amt);
        if (!date || amount <= 0) continue;
        vales.push({ date, description, amount, sheet });
      }
    }
  }
  return vales;
}

function matchEmployeeName(desc: string): string | null {
  return matchEmployeeFromVale(desc);
}

async function main() {
  if (!fs.existsSync(DADOS)) {
    console.error("Pasta dados/ não encontrada");
    process.exit(1);
  }

  const gastos = readGastosExpected();
  const vales = readValeMentions();
  const partnerEntries = readPartnerLedgerExpected();

  const rotativo = XLSX.readFile(path.join(DADOS, "ROTATIVO 2026.xlsx"), { cellDates: true });
  let rotativoRows = 0;
  let rotativoWithAmount = 0;
  for (const s of rotativo.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      rotativo.Sheets[s],
      { header: 1, defval: null, raw: false }
    );
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r?.[0]) continue;
      rotativoRows++;
      if (parseAmount(r[4]) > 0) rotativoWithAmount++;
    }
  }

  const db = {
    orders: await prisma.serviceOrder.count(),
    ordersWithTotal: await prisma.serviceOrder.count({ where: { total: { gt: 0 } } }),
    expenses: await prisma.expense.count(),
    expenseSum: (await prisma.expense.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0,
    employees: await prisma.employee.findMany({ orderBy: { name: "asc" } }),
    employeeTx: await prisma.employeeTransaction.count(),
    partners: await prisma.partnerStore.count(),
    partnerEntries: await prisma.partnerLedgerEntry.count(),
    clients: await prisma.client.count(),
  };

  const valesForTeam = vales.filter((v) => matchEmployeeName(v.description));
  const valesUnmapped = vales.filter((v) => !matchEmployeeName(v.description));

  console.log("\n=== PLANILHAS (esperado) ===");
  console.log({ rotativoRows, rotativoWithAmount, gastos: gastos.length, valesTotal: vales.length, valesTeam: valesForTeam.length, valesUnmapped: valesUnmapped.length, partnerLedger: partnerEntries.length });

  console.log("\n=== BANCO (atual) ===");
  console.log({
    orders: db.orders,
    ordersWithTotal: db.ordersWithTotal,
    expenses: db.expenses,
    expenseSum: Math.round(db.expenseSum * 100) / 100,
    employees: db.employees.map((e) => e.name),
    employeeTx: db.employeeTx,
    partners: db.partners,
    partnerEntries: db.partnerEntries,
    clients: db.clients,
  });

  const operatingExpected = gastos.length - valesForTeam.length;

  console.log("\n=== GAP ===");
  console.log(
    `Despesas operacionais: planilha ~${operatingExpected} vs banco ${db.expenses} (vales da equipe vão para /funcionarios)`
  );
  console.log(`Vales p/ equipe: planilha ${valesForTeam.length} vs banco ${db.employeeTx} transações`);
  console.log(`Lojas lançamentos: planilha ~${partnerEntries.length} vs banco ${db.partnerEntries}`);

  if (valesUnmapped.length) {
    console.log("\nVales não mapeados (funcionário fora da equipe ou nome diferente):");
    for (const v of valesUnmapped.slice(0, 15)) {
      console.log(`  ${v.sheet} | ${v.date.toISOString().slice(0, 10)} | ${v.description} | R$ ${v.amount}`);
    }
  }

  console.log("\nVales para importar (GIAN/EDSON/GABRIEL):");
  for (const v of valesForTeam.slice(0, 20)) {
    console.log(`  ${matchEmployeeName(v.description)} | ${v.date.toISOString().slice(0, 10)} | ${v.description} | R$ ${v.amount}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
