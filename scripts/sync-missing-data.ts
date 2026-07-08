/**
 * Sincroniza dados faltantes das planilhas sem apagar o banco.
 * Vales da equipe são gerenciados em /funcionarios — não são mais importados da planilha.
 *
 * Uso: npm run db:sync-missing
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createPrismaClient } from "../src/lib/create-prisma";
import { TEAM_EMPLOYEES } from "../src/lib/constants";

const DADOS = path.join(process.cwd(), "dados");
const prisma = createPrismaClient();

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

  console.log("Garantindo funcionários...");
  await ensureEmployees();

  console.log(
    "Vales da equipe não são mais importados da planilha — lance em /funcionarios."
  );
  console.log("Para fechar um ciclo de salário: npm run db:reset-employee-cycles");

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
