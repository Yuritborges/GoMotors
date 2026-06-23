import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, endOfDay, startOfDay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StockAlertsBanner } from "@/components/stock-alerts-banner";
import { PageHeader } from "@/components/layout/page-header";

async function getDashboardData() {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [ordersToday, ordersMonth, topServices, expensesMonth] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { entryAt: { gte: start, lte: end }, status: { not: "CANCELADO" } },
    }),
    prisma.serviceOrder.findMany({
      where: {
        entryAt: { gte: monthStart, lte: end },
        status: { not: "CANCELADO" },
        paymentStatus: "PAGO",
      },
    }),
    prisma.orderItem.groupBy({
      by: ["serviceName"],
      _count: { serviceName: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 5,
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: { gte: monthStart, lte: end } },
    }),
  ]);

  const dailyRevenue = ordersToday
    .filter((o) => o.paymentStatus === "PAGO")
    .reduce((sum, o) => sum + o.total, 0);

  const monthlyRevenue = ordersMonth.reduce((sum, o) => sum + o.total, 0);
  const totalExpenses = expensesMonth._sum.amount ?? 0;

  return {
    dailyRevenue,
    monthlyRevenue,
    vehiclesToday: ordersToday.length,
    averageTicket:
      ordersMonth.length > 0 ? monthlyRevenue / ordersMonth.length : 0,
    estimatedResult: monthlyRevenue - totalExpenses,
    statusCounts: {
      aguardando: ordersToday.filter((o) => o.status === "AGUARDANDO").length,
      emLavagem: ordersToday.filter((o) => o.status === "EM_LAVAGEM").length,
      pronto: ordersToday.filter((o) => o.status === "PRONTO").length,
    },
    topServices,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visão gerencial do negócio em tempo real"
      >
        <Link href="/ordens/nova" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Nova ordem</Button>
        </Link>
        <Link href="/painel" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Painel operacional
          </Button>
        </Link>
      </PageHeader>

      <StockAlertsBanner />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Faturamento hoje" value={formatCurrency(data.dailyRevenue)} />
        <StatCard title="Faturamento mensal" value={formatCurrency(data.monthlyRevenue)} />
        <StatCard title="Veículos hoje" value={String(data.vehiclesToday)} />
        <StatCard title="Ticket médio" value={formatCurrency(data.averageTicket)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Operação de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Aguardando" value={data.statusCounts.aguardando} color="text-amber-600" />
              <MiniStat label="Em lavagem" value={data.statusCounts.emLavagem} color="text-blue-600" />
              <MiniStat label="Prontos" value={data.statusCounts.pronto} color="text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado estimado (mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {formatCurrency(data.estimatedResult)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Faturamento − despesas do mês
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Serviços mais vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topServices.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum serviço registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.topServices.map((service) => (
                <div
                  key={service.serviceName}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium">{service.serviceName}</span>
                  <span className="text-sm text-slate-500">
                    {service._count.serviceName} vendas
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-slate-500 sm:text-sm">{title}</p>
        <p className="mt-1 text-lg font-bold text-slate-900 sm:mt-2 sm:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center sm:p-4">
      <p className={`text-2xl font-bold sm:text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}
