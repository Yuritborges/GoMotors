import { prisma } from "@/lib/prisma";
import { computeBalance, summarizeByType } from "@/lib/employee-ledger";
import { endOfDay, startOfDay } from "@/lib/utils";

export type FinancePeriod = {
  from: Date;
  to: Date;
  label: string;
};

export type DailyFlowPoint = {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
};

export type FinanceSummary = {
  period: FinancePeriod;
  previousPeriod: FinancePeriod;
  revenue: number;
  pendingRevenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  vehicleCount: number;
  paidOrderCount: number;
  averageTicket: number;
  revenueChangePercent: number | null;
  expenseChangePercent: number | null;
  profitChangePercent: number | null;
  dailyFlow: DailyFlowPoint[];
  expensesByCategory: { category: string; amount: number }[];
  revenueByPayment: { method: string; amount: number }[];
  pendingByPayment: { method: string; amount: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  topClients: { name: string; visits: number }[];
  suggestedMonth: string | null;
  operatingExpenses: number;
  employeeLedger: {
    vales: number;
    reembolsos: number;
    descontos: number;
    net: number;
  };
  employeeByPerson: {
    id: string;
    name: string;
    vales: number;
    reembolsos: number;
    descontos: number;
    net: number;
    balance: number;
  }[];
};

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    date
  );
}

export function resolveFinancePeriod(
  monthParam?: string | null,
  fromParam?: string | null,
  toParam?: string | null
): FinancePeriod {
  if (fromParam && toParam) {
    const from = startOfDay(new Date(fromParam));
    const to = endOfDay(new Date(toParam));
    return {
      from,
      to,
      label: `${from.toLocaleDateString("pt-BR")} – ${to.toLocaleDateString("pt-BR")}`,
    };
  }

  let base = new Date();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    base = new Date(y, m - 1, 1);
  }

  const from = startOfDay(new Date(base.getFullYear(), base.getMonth(), 1));
  const to = endOfDay(new Date(base.getFullYear(), base.getMonth() + 1, 0));
  return { from, to, label: monthLabel(from) };
}

export function previousPeriod(period: FinancePeriod): FinancePeriod {
  const from = startOfDay(
    new Date(period.from.getFullYear(), period.from.getMonth() - 1, 1)
  );
  const to = endOfDay(new Date(period.from.getFullYear(), period.from.getMonth(), 0));
  return { from, to, label: monthLabel(from) };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildDailyFlow(
  from: Date,
  to: Date,
  revenueByDay: Map<string, number>,
  expenseByDay: Map<string, number>
): DailyFlowPoint[] {
  const points: DailyFlowPoint[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);

  while (cursor <= end) {
    const key = dateKey(cursor);
    const revenue = revenueByDay.get(key) ?? 0;
    const expenses = expenseByDay.get(key) ?? 0;
    points.push({
      date: key,
      revenue,
      expenses,
      profit: revenue - expenses,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

async function getLatestMonthWithData(): Promise<string | null> {
  const latest = await prisma.serviceOrder.findFirst({
    where: { status: { not: "CANCELADO" }, total: { gt: 0 } },
    orderBy: { entryAt: "desc" },
    select: { entryAt: true },
  });
  if (!latest) return null;
  const d = latest.entryAt;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function aggregatePeriod(from: Date, to: Date) {
  const [
    paidOrders,
    pendingOrdersAgg,
    pendingOrdersList,
    expenses,
    employeeTransactions,
    employeesWithTx,
    topServices,
    topClientsRaw,
  ] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: {
        entryAt: { gte: from, lte: to },
        status: { not: "CANCELADO" },
        paymentStatus: "PAGO",
      },
      select: { total: true, entryAt: true, paymentMethod: true },
    }),
    prisma.serviceOrder.aggregate({
      _sum: { total: true },
      where: {
        entryAt: { gte: from, lte: to },
        status: { not: "CANCELADO" },
        paymentStatus: "PENDENTE",
      },
    }),
    prisma.serviceOrder.findMany({
      where: {
        entryAt: { gte: from, lte: to },
        status: { not: "CANCELADO" },
        paymentStatus: "PENDENTE",
      },
      select: { total: true, paymentMethod: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { amount: true, date: true, category: true },
    }),
    prisma.employeeTransaction.findMany({
      where: { date: { gte: from, lte: to } },
      select: { amount: true, date: true, type: true, employeeId: true },
    }),
    prisma.employee.findMany({
      include: { transactions: { select: { type: true, amount: true, date: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.orderItem.groupBy({
      by: ["serviceName"],
      where: {
        order: {
          entryAt: { gte: from, lte: to },
          status: { not: "CANCELADO" },
          paymentStatus: "PAGO",
        },
      },
      _count: { serviceName: true },
      _sum: { price: true },
      orderBy: { _sum: { price: "desc" } },
      take: 8,
    }),
    prisma.serviceOrder.groupBy({
      by: ["clientId"],
      where: {
        entryAt: { gte: from, lte: to },
        status: { not: "CANCELADO" },
      },
      _count: { clientId: true },
      orderBy: { _count: { clientId: "desc" } },
      take: 5,
    }),
  ]);

  const revenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const pendingRevenue = pendingOrdersAgg._sum.total ?? 0;
  const operatingExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const employeeSummary = summarizeByType(employeeTransactions);
  const employeeNet = employeeSummary.netExpense;
  const expenseTotal = operatingExpenses + employeeNet;

  const revenueByDay = new Map<string, number>();
  const paymentTotals = new Map<string, number>();
  const pendingPaymentTotals = new Map<string, number>();
  for (const o of paidOrders) {
    const key = dateKey(o.entryAt);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + o.total);
    paymentTotals.set(
      o.paymentMethod,
      (paymentTotals.get(o.paymentMethod) ?? 0) + o.total
    );
  }

  for (const o of pendingOrdersList) {
    pendingPaymentTotals.set(
      o.paymentMethod,
      (pendingPaymentTotals.get(o.paymentMethod) ?? 0) + o.total
    );
  }

  const expenseByDay = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  for (const e of expenses) {
    const key = dateKey(e.date);
    expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + e.amount);
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount);
  }

  for (const t of employeeTransactions) {
    const key = dateKey(t.date);
    const impact =
      t.type === "DESCONTO" ? -t.amount : t.amount;
    expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + impact);
    categoryTotals.set(
      "FUNCIONARIOS",
      (categoryTotals.get("FUNCIONARIOS") ?? 0) + impact
    );
  }

  const employeeByPerson = employeesWithTx
    .map((emp) => {
      const periodTx = emp.transactions.filter(
        (t) => t.date >= from && t.date <= to
      );
      const summary = summarizeByType(periodTx);
      return {
        id: emp.id,
        name: emp.name,
        vales: summary.vales,
        reembolsos: summary.reembolsos,
        descontos: summary.descontos,
        net: summary.netExpense,
        balance: computeBalance(emp.transactions),
      };
    })
    .filter((e) => e.net !== 0 || e.vales || e.reembolsos || e.descontos)
    .sort((a, b) => b.net - a.net);

  const clientIds = topClientsRaw.map((c) => c.clientId);
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({ where: { id: { in: clientIds } } })
      : [];
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  return {
    revenue,
    pendingRevenue,
    operatingExpenses,
    employeeLedger: {
      vales: employeeSummary.vales,
      reembolsos: employeeSummary.reembolsos,
      descontos: employeeSummary.descontos,
      net: employeeNet,
    },
    employeeByPerson,
    expenses: expenseTotal,
    profit: revenue - expenseTotal,
    vehicleCount: await prisma.serviceOrder.count({
      where: {
        entryAt: { gte: from, lte: to },
        status: { not: "CANCELADO" },
      },
    }),
    paidOrderCount: paidOrders.length,
    averageTicket: paidOrders.length ? revenue / paidOrders.length : 0,
    dailyFlow: buildDailyFlow(from, to, revenueByDay, expenseByDay),
    expensesByCategory: [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    revenueByPayment: [...paymentTotals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    pendingByPayment: [...pendingPaymentTotals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    topServices: topServices.map((s) => ({
      name: s.serviceName,
      count: s._count.serviceName,
      revenue: s._sum.price ?? 0,
    })),
    topClients: topClientsRaw.map((c) => ({
      name: clientMap[c.clientId] ?? "—",
      visits: c._count.clientId,
    })),
  };
}

export async function getFinanceSummary(
  monthParam?: string | null,
  fromParam?: string | null,
  toParam?: string | null
): Promise<FinanceSummary> {
  const period = resolveFinancePeriod(monthParam, fromParam, toParam);
  const prev = previousPeriod(period);

  const [current, previous, suggestedMonth] = await Promise.all([
    aggregatePeriod(period.from, period.to),
    aggregatePeriod(prev.from, prev.to),
    getLatestMonthWithData(),
  ]);

  const marginPercent =
    current.revenue > 0
      ? Math.round((current.profit / current.revenue) * 1000) / 10
      : 0;

  return {
    period,
    previousPeriod: prev,
    revenue: current.revenue,
    pendingRevenue: current.pendingRevenue,
    expenses: current.expenses,
    operatingExpenses: current.operatingExpenses,
    employeeLedger: current.employeeLedger,
    employeeByPerson: current.employeeByPerson,
    profit: current.profit,
    marginPercent,
    vehicleCount: current.vehicleCount,
    paidOrderCount: current.paidOrderCount,
    averageTicket: current.averageTicket,
    revenueChangePercent: pctChange(current.revenue, previous.revenue),
    expenseChangePercent: pctChange(current.expenses, previous.expenses),
    profitChangePercent: pctChange(current.profit, previous.profit),
    dailyFlow: current.dailyFlow,
    expensesByCategory: current.expensesByCategory,
    revenueByPayment: current.revenueByPayment,
    pendingByPayment: current.pendingByPayment,
    topServices: current.topServices,
    topClients: current.topClients,
    suggestedMonth,
  };
}
