import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { handleAuthError, requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireOwner();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const today = dateParam ? new Date(dateParam) : new Date();
  const start = startOfDay(today);
  const end = endOfDay(today);

  const orders = await prisma.serviceOrder.findMany({
    where: {
      entryAt: { gte: start, lte: end },
      status: { not: "CANCELADO" },
    },
    include: { payments: true },
  });

  const paidOrders = orders.filter((o) => o.paymentStatus === "PAGO");
  const pendingOrders = orders.filter((o) => o.paymentStatus === "PENDENTE");

  const byMethod: Record<string, number> = {};
  for (const order of paidOrders) {
    for (const payment of order.payments) {
      if (payment.type === "PAGAMENTO") {
        byMethod[payment.method] = (byMethod[payment.method] ?? 0) + payment.amount;
      } else {
        byMethod[payment.method] = (byMethod[payment.method] ?? 0) - payment.amount;
      }
    }
  }

  const totalSold = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const totalDiscounts = orders.reduce((sum, o) => sum + o.discount, 0);
  const pendingAmount = pendingOrders.reduce((sum, o) => sum + o.total, 0);
  const averageTicket = paidOrders.length > 0 ? totalSold / paidOrders.length : 0;

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const ordersWithVehicle = await prisma.serviceOrder.findMany({
    where: {
      entryAt: { gte: start, lte: end },
      status: { not: "CANCELADO" },
      paymentStatus: "PENDENTE",
    },
    include: { vehicle: true, client: true },
    orderBy: { entryAt: "desc" },
  });

  return NextResponse.json({
    date: today.toISOString(),
    totalSold,
    totalDiscounts,
    pendingAmount,
    vehicleCount: orders.length,
    paidCount: paidOrders.length,
    pendingPaymentCount: pendingOrders.length,
    averageTicket,
    byPaymentMethod: byMethod,
    totalExpenses,
    estimatedResult: totalSold - totalExpenses,
    pendingOrders: ordersWithVehicle.map((o) => ({
      id: o.id,
      total: o.total,
      status: o.status,
      plate: o.vehicle.plate,
      clientName: o.client.name,
    })),
  });
  } catch (error) {
    return handleAuthError(error);
  }
}
