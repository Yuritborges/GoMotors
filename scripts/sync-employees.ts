/**
 * Mantém somente a equipe fixa Go Motors no banco.
 * Uso: npm run db:sync-employees
 */
import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";
import { TEAM_EMPLOYEES } from "../src/lib/constants";

const prisma = createPrismaClient();

async function main() {
  const keepNames = new Set<string>(TEAM_EMPLOYEES);

  for (const name of TEAM_EMPLOYEES) {
    const existing = await prisma.employee.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: { name, active: true },
      });
    } else {
      await prisma.employee.create({ data: { name, active: true } });
    }
  }

  const all = await prisma.employee.findMany();
  const toRemove = all.filter((e) => !keepNames.has(e.name.toUpperCase()));

  for (const emp of toRemove) {
    await prisma.employee.delete({ where: { id: emp.id } });
  }

  const final = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  console.log(
    "Funcionários ativos:",
    final.map((e) => e.name).join(", ")
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
