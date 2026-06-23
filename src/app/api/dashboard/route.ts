import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { handleAuthError, requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireOwner();
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const from = fromParam ? startOfDay(new Date(fromParam)) : startOfDay(new Date());
  const to = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());

  const [
    ordersToday,
    ordersMonth,
    topServices,
    paymentMethods,
    topClients,
    expensesByCategory,
    expensesTotal,
  ] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: {
        entryAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
        status: { not: "CANCELADO" },
      },
    }),
    prisma.serviceOrder.findMany({
      where: {
        entryAt: { gte: from, lte: to },
        status: { not: "CANCELADO" },
        paymentStatus: "PAGO",
      },
    }),
    prisma.orderItem.groupBy({
      by: ["serviceName"],
      _count: { serviceName: true },
      _sum: { price: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 5,
    }),
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      where: {
        createdAt: { gte: from, lte: to },
        type: "PAGAMENTO",
      },
    }),
    prisma.serviceOrder.groupBy({
      by: ["clientId"],
      _count: { clientId: true },
      orderBy: { _count: { clientId: "desc" } },
      take: 5,
    }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      where: { date: { gte: from, lte: to } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: { gte: from, lte: to } },
    }),
  ]);

  const clientIds = topClients.map((c) => c.clientId);
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
  });
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const dailyRevenue = ordersToday
    .filter((o) => o.paymentStatus === "PAGO")
    .reduce((sum, o) => sum + o.total, 0);

  const monthlyRevenue = ordersMonth.reduce((sum, o) => sum + o.total, 0);
  const monthlyVehicles = ordersMonth.length;
  const averageTicket = monthlyVehicles > 0 ? monthlyRevenue / monthlyVehicles : 0;

  const statusCounts = {
    aguardando: ordersToday.filter((o) => o.status === "AGUARDANDO").length,
    emLavagem: ordersToday.filter((o) => o.status === "EM_LAVAGEM").length,
    finalizacao: ordersToday.filter((o) => o.status === "FINALIZACAO").length,
    pronto: ordersToday.filter((o) => o.status === "PRONTO").length,
    entregue: ordersToday.filter((o) => o.status === "ENTREGUE").length,
  };

  return NextResponse.json({
    dailyRevenue,
    monthlyRevenue,
    monthlyVehicles,
    averageTicket,
    statusCounts,
    topServices,
    paymentMethods,
    topClients: topClients.map((c) => ({
      clientId: c.clientId,
      name: clientMap[c.clientId] ?? "—",
      visits: c._count.clientId,
    })),
    expensesByCategory,
    totalExpenses: expensesTotal._sum.amount ?? 0,
    estimatedResult: monthlyRevenue - (expensesTotal._sum.amount ?? 0),
  });
  } catch (error) {
    return handleAuthError(error);
  }
}
