/**
 * Sincroniza dados faltantes das planilhas sem apagar o banco.
 * Hoje: vales da equipe (GIAN/EDSON/GABRIEL) → EmployeeTransaction
 *       e remove despesas duplicadas com o mesmo vale.
 *
 * Uso: npm run db:sync-missing
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { createPrismaClient } from "../src/lib/create-prisma";
import { TEAM_EMPLOYEES } from "../src/lib/constants";
import {
  isTeamValeExpense,
  matchEmployeeFromVale,
  parseAmount,
  parseExcelDate,
} from "./import-utils";

const DADOS = path.join(process.cwd(), "dados");
const prisma = createPrismaClient();

function readGastosVales() {
  const wb = XLSX.readFile(path.join(DADOS, "GASTOS LAVA RAPIDO 2026.xlsx"), {
    cellDates: true,
  });
  const rows: { date: Date; description: string; amount: number }[] = [];

  function pushRow(dateRaw: unknown, descRaw: unknown, amountRaw: unknown) {
    const date = parseExcelDate(dateRaw);
    const description = String(descRaw ?? "").trim();
    const amount = parseAmount(amountRaw);
    if (!date || !description || amount <= 0) return;
    if (!isTeamValeExpense(description)) return;
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

function txKey(employeeId: string, date: Date, amount: number, description: string) {
  return `${employeeId}|${date.toISOString().slice(0, 10)}|${amount}|${description.slice(0, 80)}`;
}

async function ensureEmployees() {
  const existing = await prisma.employee.findMany();
  const byName = new Map(existing.map((e) => [e.name, e.id]));
  for (const name of TEAM_EMPLOYEES) {
    if (!byName.has(name)) {
      const created = await prisma.employee.create({ data: { name, active: true } });
      byName.set(name, created.id);
      console.log(`  + funcionário criado: ${name}`);
    }
  }
  return byName;
}

async function main() {
  if (!fs.existsSync(DADOS)) {
    throw new Error(`Pasta não encontrada: ${DADOS}`);
  }

  console.log("Lendo vales da planilha GASTOS...");
  const vales = readGastosVales();
  console.log(`  ${vales.length} vales da equipe na planilha`);

  console.log("Garantindo funcionários...");
  const employeeByName = await ensureEmployees();

  const existingTx = await prisma.employeeTransaction.findMany({
    where: { type: "VALE" },
    select: { employeeId: true, date: true, amount: true, description: true },
  });
  const existingKeys = new Set(
    existingTx.map((t) =>
      txKey(t.employeeId, t.date, t.amount, t.description ?? "")
    )
  );

  let created = 0;
  for (const v of vales) {
    const empName = matchEmployeeFromVale(v.description);
    if (!empName) continue;
    const employeeId = employeeByName.get(empName);
    if (!employeeId) continue;

    const key = txKey(employeeId, v.date, v.amount, v.description);
    if (existingKeys.has(key)) continue;

    await prisma.employeeTransaction.create({
      data: {
        employeeId,
        type: "VALE",
        amount: v.amount,
        date: v.date,
        description: v.description.slice(0, 200),
      },
    });
    existingKeys.add(key);
    created += 1;
  }

  console.log(`  ${created} vales importados como EmployeeTransaction`);

  const teamExpenses = await prisma.expense.findMany({
    where: {
      OR: TEAM_EMPLOYEES.map((name) => ({
        description: { contains: name, mode: "insensitive" as const },
      })),
    },
    select: { id: true, date: true, amount: true, description: true },
  });

  const valeExpenseIds: string[] = [];
  for (const e of teamExpenses) {
    if (!e.description || !/vale/i.test(e.description)) continue;
    if (!matchEmployeeFromVale(e.description)) continue;
    valeExpenseIds.push(e.id);
  }

  if (valeExpenseIds.length > 0) {
    const removed = await prisma.expense.deleteMany({
      where: { id: { in: valeExpenseIds } },
    });
    console.log(`  ${removed.count} despesas duplicadas (vales) removidas`);
  }

  const summary = await Promise.all([
    prisma.employeeTransaction.count({ where: { type: "VALE" } }),
    prisma.expense.count(),
  ]);

  console.log("\nSincronização concluída:", {
    valesNoBanco: summary[0],
    despesasNoBanco: summary[1],
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
