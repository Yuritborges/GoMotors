import Link from "next/link";
import { getFinanceSummary } from "@/lib/finance";
import { formatCurrency, endOfDay, startOfDay } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StockAlertsBanner } from "@/components/stock-alerts-banner";
import { PageHeader } from "@/components/layout/page-header";

async function getTodayOps() {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());
  const ordersToday = await prisma.serviceOrder.findMany({
    where: { entryAt: { gte: start, lte: end }, status: { not: "CANCELADO" } },
  });
  return {
    vehiclesToday: ordersToday.length,
    dailyRevenue: ordersToday
      .filter((o) => o.paymentStatus === "PAGO")
      .reduce((sum, o) => sum + o.total, 0),
    statusCounts: {
      aguardando: ordersToday.filter((o) => o.status === "AGUARDANDO").length,
      emLavagem: ordersToday.filter((o) => o.status === "EM_LAVAGEM").length,
      pronto: ordersToday.filter((o) => o.status === "PRONTO").length,
    },
    topServices: await prisma.orderItem.groupBy({
      by: ["serviceName"],
      _count: { serviceName: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 5,
    }),
  };
}

export default async function DashboardPage() {
  const [finance, today] = await Promise.all([getFinanceSummary(), getTodayOps()]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description="Go Motors — visão gerencial em tempo real"
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
        <StatCard title="Faturamento hoje" value={formatCurrency(today.dailyRevenue)} />
        <StatCard title="Receita do mês" value={formatCurrency(finance.revenue)} accent="emerald" />
        <StatCard title="Despesas do mês" value={formatCurrency(finance.expenses)} accent="red" />
        <StatCard
          title="Lucro do mês"
          value={formatCurrency(finance.profit)}
          accent={finance.profit >= 0 ? "sky" : "red"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Operação de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Veículos hoje" value={today.vehiclesToday} color="text-slate-800" />
              <MiniStat label="Aguardando" value={today.statusCounts.aguardando} color="text-amber-600" />
              <MiniStat label="Em lavagem" value={today.statusCounts.emLavagem} color="text-blue-600" />
              <MiniStat label="Prontos" value={today.statusCounts.pronto} color="text-emerald-600" />
            </div>
            <Link href="/painel" className="text-sm font-medium text-sky-600 hover:text-sky-700">
              Abrir painel Kanban →
            </Link>
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-sky-50/30">
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
            <p className="text-sm capitalize text-slate-600">{finance.period.label}</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Margem de lucro" value={`${finance.marginPercent}%`} />
            <Row label="Ticket médio" value={formatCurrency(finance.averageTicket)} />
            <Row label="A receber" value={formatCurrency(finance.pendingRevenue)} />
            <Link href="/financeiro" className="mt-3 inline-block">
              <Button size="sm" className="w-full">
                Ver financeiro completo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Serviços mais vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {today.topServices.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum serviço registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {today.topServices.map((service) => (
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

function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent?: "emerald" | "red" | "sky";
}) {
  const accents = {
    emerald: "border-emerald-200 bg-emerald-50/30",
    red: "border-red-200 bg-red-50/30",
    sky: "border-sky-200 bg-sky-50/30",
  };
  return (
    <Card className={accent ? accents[accent] : undefined}>
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
      <p className="mt-1 text-xs text-slate-600 sm:text-sm">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
