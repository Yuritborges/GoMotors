import { prisma } from "@/lib/prisma";
import { excludeImportedOrdersWhere } from "@/lib/imported-orders";
import { endOfDay, startOfDay } from "@/lib/utils";

export type PendingOrderRow = {
  id: string;
  plate: string;
  total: number;
  status: string;
  paymentMethod: string;
  entryAt: string;
  services: string[];
};

export type PendingClientRow = {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  orderCount: number;
  totalAmount: number;
  monthlyAmount: number;
  payLaterAmount: number;
  primaryMethod: "FECHAMENTO_MENSAL" | "PAGAR_DEPOIS" | "MIXED";
  orders: PendingOrderRow[];
};

export type RecentSettlementRow = {
  clientId: string;
  clientName: string;
  amount: number;
  method: string;
  paidAt: string;
  plates: string[];
  orderCount: number;
  isMonthlyClosing: boolean;
};

export async function fetchPendingByClient(): Promise<PendingClientRow[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: {
      paymentStatus: "PENDENTE",
      status: { not: "CANCELADO" },
      ...excludeImportedOrdersWhere,
    },
    include: {
      client: true,
      vehicle: true,
      items: true,
    },
    orderBy: [{ client: { name: "asc" } }, { entryAt: "asc" }],
  });

  const map = new Map<string, PendingClientRow>();

  for (const order of orders) {
    const row = map.get(order.clientId) ?? {
      clientId: order.clientId,
      clientName: order.client.name,
      clientPhone: order.client.phone,
      orderCount: 0,
      totalAmount: 0,
      monthlyAmount: 0,
      payLaterAmount: 0,
      primaryMethod: "PAGAR_DEPOIS" as const,
      orders: [],
    };

    row.orderCount += 1;
    row.totalAmount += order.total;
    if (order.paymentMethod === "FECHAMENTO_MENSAL") {
      row.monthlyAmount += order.total;
    } else {
      row.payLaterAmount += order.total;
    }

    row.orders.push({
      id: order.id,
      plate: order.vehicle.plate,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      entryAt: order.entryAt.toISOString(),
      services: order.items.map((i) => i.serviceName),
    });

    map.set(order.clientId, row);
  }

  const clients = [...map.values()].map((c) => {
    const hasMonthly = c.monthlyAmount > 0;
    const hasPayLater = c.payLaterAmount > 0;
    let primaryMethod: PendingClientRow["primaryMethod"] = "MIXED";
    if (hasMonthly && !hasPayLater) primaryMethod = "FECHAMENTO_MENSAL";
    else if (!hasMonthly && hasPayLater) primaryMethod = "PAGAR_DEPOIS";
    return { ...c, primaryMethod };
  });

  return clients.sort((a, b) => b.totalAmount - a.totalAmount);
}

export async function fetchRecentSettlements(
  day: Date = new Date()
): Promise<RecentSettlementRow[]> {
  const start = startOfDay(day);
  const end = endOfDay(day);

  const payments = await prisma.payment.findMany({
    where: {
      type: "PAGAMENTO",
      createdAt: { gte: start, lte: end },
      order: excludeImportedOrdersWhere,
    },
    include: {
      order: {
        include: {
          client: true,
          vehicle: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const batches = new Map<string, RecentSettlementRow>();

  for (const payment of payments) {
    const clientId = payment.order.clientId;
    const minuteKey = `${clientId}:${payment.createdAt.toISOString().slice(0, 16)}`;
    const isMonthlyClosing = payment.notes?.includes("Fechamento mensal") ?? false;
    const key = isMonthlyClosing ? minuteKey : `${payment.id}`;

    const existing = batches.get(key);
    if (existing) {
      existing.amount += payment.amount;
      existing.orderCount += 1;
      if (!existing.plates.includes(payment.order.vehicle.plate)) {
        existing.plates.push(payment.order.vehicle.plate);
      }
      continue;
    }

    batches.set(key, {
      clientId,
      clientName: payment.order.client.name,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.createdAt.toISOString(),
      plates: [payment.order.vehicle.plate],
      orderCount: 1,
      isMonthlyClosing,
    });
  }

  return [...batches.values()].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
}

export function summarizePendingClients(clients: PendingClientRow[]) {
  return {
    clientCount: clients.length,
    orderCount: clients.reduce((s, c) => s + c.orderCount, 0),
    totalAmount: clients.reduce((s, c) => s + c.totalAmount, 0),
    monthlyAmount: clients.reduce((s, c) => s + c.monthlyAmount, 0),
    payLaterAmount: clients.reduce((s, c) => s + c.payLaterAmount, 0),
  };
}
