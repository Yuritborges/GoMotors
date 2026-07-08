import { prisma } from "@/lib/prisma";
import { businessDayBounds, businessDateKey, parseBusinessDateInput } from "@/lib/business-day";
import { isDeferredPaymentMethod } from "@/lib/payments";
import { isImportedHistoricalOrder } from "@/lib/imported-orders";
import { buildLaneBreakdown } from "@/lib/lane-breakdown";
import type { DisplayOrderInput } from "@/lib/display-lanes-types";
import { summarizeByType } from "@/lib/employee-ledger";

export type DailyCashReport = {
  date: string;
  dateLabel: string;
  totalSold: number;
  totalDiscounts: number;
  pendingAmount: number;
  payLaterAmount: number;
  vehicleCount: number;
  paidCount: number;
  pendingPaymentCount: number;
  averageTicket: number;
  byPaymentMethod: Record<string, number>;
  totalExpenses: number;
  employeeExpenses: number;
  estimatedResult: number;
  statusBreakdown: {
    aguardando: number;
    emLavagem: number;
    finalizacao: number;
    prontos: number;
    entregues: number;
  };
  laneBreakdown: { lane: string; label: string; count: number; fixed: boolean }[];
  hourlyRevenue: { hour: number; amount: number }[];
  expenses: { description: string; category: string; amount: number }[];
  pendingOrders: {
    id: string;
    total: number;
    status: string;
    paymentMethod: string;
    plate: string;
    clientName: string;
    entryAt: string;
  }[];
  todayOrders: {
    id: string;
    plate: string;
    clientName: string;
    total: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    services: string;
    entryAt: string;
    imported: boolean;
  }[];
};

function dateLabelFor(d: Date) {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function parseCashDateParam(dateParam?: string | null): Date {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return parseBusinessDateInput(dateParam);
  }
  return parseBusinessDateInput(businessDateKey());
}

export function cashDateKey(d: Date): string {
  return businessDateKey(d);
}

export async function buildDailyCashReport(dateParam?: string | null): Promise<DailyCashReport> {
  const dateKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : businessDateKey();
  const day = parseBusinessDateInput(dateKey);
  const { start, end } = businessDayBounds(dateKey);

  const [orders, expenses, employeeTransactions] = await Promise.all([
    prisma.serviceOrder.findMany({
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
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.employeeTransaction.findMany({
      where: { date: { gte: start, lte: end } },
    }),
  ]);

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
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const employeeSummary = summarizeByType(employeeTransactions);
  const employeeExpenses = employeeSummary.netExpense;
  const estimatedResult = totalSold - totalExpenses - employeeExpenses;

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

  return {
    date: dateKey,
    dateLabel: dateLabelFor(day),
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
    employeeExpenses,
    estimatedResult,
    statusBreakdown,
    laneBreakdown,
    hourlyRevenue,
    expenses: expenses.map((e) => ({
      description: e.description,
      category: e.category,
      amount: e.amount,
    })),
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
      imported: isImportedHistoricalOrder(o.notes),
    })),
  };
}
