import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { isDeferredPaymentMethod } from "@/lib/payments";
import { isImportedHistoricalOrder } from "@/lib/imported-orders";
import { buildLaneBreakdown } from "@/lib/lane-breakdown";
import type { DisplayOrderInput } from "@/lib/display-lanes-types";

export async function GET(request: Request) {
  try {
    await requireOwner();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const today = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const orders = await prisma.serviceOrder.findMany({
      where: {
        entryAt: { gte: start, lte: end },
        status: { not: "CANCELADO" },
      },
      include: {
        payments: true,
        vehicle: true,
        client: true,
        items: true,
      },
      orderBy: { entryAt: "desc" },
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

    const statusBreakdown = {
      aguardando: orders.filter((o) => o.status === "AGUARDANDO").length,
      emLavagem: orders.filter((o) => o.status === "EM_LAVAGEM").length,
      finalizacao: orders.filter((o) => o.status === "FINALIZACAO").length,
      prontos: orders.filter((o) => o.status === "PRONTO").length,
      entregues: orders.filter((o) => o.status === "ENTREGUE").length,
    };

    const activeOrders: DisplayOrderInput[] = orders
      .filter(
        (o) =>
          o.status !== "ENTREGUE" &&
          o.status !== "CANCELADO" &&
          !isImportedHistoricalOrder(o.notes)
      )
      .map((o) => ({
        id: o.id,
        status: o.status,
        currentLane: o.currentLane,
        client: { name: o.client.name },
        vehicle: { plate: o.vehicle.plate },
        items: o.items.map((i) => ({
          serviceName: i.serviceName,
          employee: null,
        })),
      }));

    const laneBreakdown = buildLaneBreakdown(activeOrders);

    const hourlyMap = new Map<number, number>();
    for (const order of paidOrders) {
      const hour = order.entryAt.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + order.total);
    }
    const hourlyRevenue = [...hourlyMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, amount]) => ({ hour, amount }));

    const payLaterAmount = pendingOrders
      .filter((o) => isDeferredPaymentMethod(o.paymentMethod))
      .reduce((sum, o) => sum + o.total, 0);

    return NextResponse.json({
      date: today.toISOString(),
      totalSold,
      totalDiscounts,
      pendingAmount,
      payLaterAmount,
      vehicleCount: orders.length,
      paidCount: paidOrders.length,
      pendingPaymentCount: pendingOrders.length,
      averageTicket,
      byPaymentMethod: byMethod,
      totalExpenses,
      estimatedResult: totalSold - totalExpenses,
      statusBreakdown,
      laneBreakdown,
      hourlyRevenue,
      pendingOrders: pendingOrders.map((o) => ({
        id: o.id,
        total: o.total,
        status: o.status,
        paymentMethod: o.paymentMethod,
        plate: o.vehicle.plate,
        clientName: o.client.name,
        entryAt: o.entryAt.toISOString(),
      })),
      todayOrders: orders.map((o) => ({
        id: o.id,
        plate: o.vehicle.plate,
        clientName: o.client.name,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        services: o.items.map((i) => i.serviceName).join(", "),
        entryAt: o.entryAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
