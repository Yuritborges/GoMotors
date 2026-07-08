/**
 * Fecha o ciclo de salário de todos os funcionários sem apagar o histórico.
 * Uso: npm run db:reset-employee-cycles
 */
import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";
import { closeAllEmployeeSalaryCycles } from "../src/lib/employee-cycle-close";

const prisma = createPrismaClient();

async function main() {
  const paidAt = new Date();
  const results = await closeAllEmployeeSalaryCycles(prisma, paidAt);

  console.log(
    `Fechando ciclos em ${paidAt.toLocaleDateString("pt-BR")} (histórico preservado)...\n`
  );

  for (const r of results) {
    if (r.status === "paid") {
      console.log(
        `  ${r.name}: R$ ${r.amount.toFixed(2)} pago · ${r.historyCount} lançamento(s) preservado(s) · restante R$ 0,00`
      );
    } else {
      console.log(`  ${r.name}: ${r.reason} · ${r.historyCount} lançamento(s) no histórico`);
    }
  }

  console.log(
    "\nCiclo reiniciado. Histórico antigo permanece; só novos vales/descontos abatem o salário."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
