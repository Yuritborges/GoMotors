import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";

const prisma = createPrismaClient();

async function main() {
const total = await prisma.serviceOrder.count();
const paid = await prisma.serviceOrder.count({ where: { paymentStatus: "PAGO" } });
const pending = await prisma.serviceOrder.count({ where: { paymentStatus: "PENDENTE" } });
const sumPaid = await prisma.serviceOrder.aggregate({
  where: { paymentStatus: "PAGO" },
  _sum: { total: true },
});
const sumPending = await prisma.serviceOrder.aggregate({
  where: { paymentStatus: "PENDENTE" },
  _sum: { total: true },
});
const zeroTotal = await prisma.serviceOrder.count({ where: { total: 0 } });
const expenses = await prisma.expense.count();
const expSum = await prisma.expense.aggregate({ _sum: { amount: true } });

const orders = await prisma.serviceOrder.findMany({
  select: { entryAt: true, total: true, paymentStatus: true },
});

const byMonth: Record<string, { count: number; paidRevenue: number; allRevenue: number }> = {};
for (const o of orders) {
  const m = o.entryAt.toISOString().slice(0, 7);
  if (!byMonth[m]) byMonth[m] = { count: 0, paidRevenue: 0, allRevenue: 0 };
  byMonth[m].count++;
  byMonth[m].allRevenue += o.total;
  if (o.paymentStatus === "PAGO") byMonth[m].paidRevenue += o.total;
}

console.log("=== ORDENS ===");
console.log({
  total,
  paid,
  pending,
  sumPaid: sumPaid._sum.total,
  sumPending: sumPending._sum.total,
  zeroTotal,
});
console.log("=== DESPESAS ===");
console.log({ expenses, expSum: expSum._sum.amount });
console.log("=== POR MÊS ===");
console.log(JSON.stringify(byMonth, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
