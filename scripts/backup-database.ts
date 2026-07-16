/**
 * Backup lógico do banco (JSON) antes de publicar em produção.
 * Uso: npx tsx scripts/backup-database.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createPrismaClient } from "../src/lib/create-prisma";

async function main() {
  const prisma = createPrismaClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(process.cwd(), "backups", `backup-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Backup em ${outDir}`);

  const tables = {
    users: await prisma.user.findMany(),
    clients: await prisma.client.findMany(),
    vehicles: await prisma.vehicle.findMany(),
    services: await prisma.service.findMany(),
    serviceVehiclePrices: await prisma.serviceVehiclePrice.findMany(),
    products: await prisma.product.findMany(),
    employees: await prisma.employee.findMany(),
    employeeTransactions: await prisma.employeeTransaction.findMany(),
    partnerStores: await prisma.partnerStore.findMany(),
    partnerLedgerEntries: await prisma.partnerLedgerEntry.findMany(),
    serviceOrders: await prisma.serviceOrder.findMany(),
    orderItems: await prisma.orderItem.findMany(),
    payments: await prisma.payment.findMany(),
    expenses: await prisma.expense.findMany(),
    cashClosings: await prisma.cashClosing.findMany(),
    stockMovements: await prisma.stockMovement.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
    shopSettings: await prisma.shopSettings.findMany(),
  };

  const summary: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) {
    summary[name] = rows.length;
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(rows, null, 2),
      "utf8"
    );
  }

  fs.writeFileSync(
    path.join(outDir, "_manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        purpose: "Backup antes de promote:prod (somente código)",
        counts: summary,
      },
      null,
      2
    ),
    "utf8"
  );

  await prisma.$disconnect();
  console.log("Contagens:", summary);
  console.log("Backup concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
