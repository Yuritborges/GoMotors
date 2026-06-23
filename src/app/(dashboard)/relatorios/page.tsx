"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

type DashboardData = {
  monthlyRevenue: number;
  monthlyVehicles: number;
  averageTicket: number;
  estimatedResult: number;
  topServices: { serviceName: string; _count: { serviceName: number } }[];
  paymentMethods: { method: string; _sum: { amount: number | null } }[];
  expensesByCategory: { category: string; _sum: { amount: number | null } }[];
  topClients: { name: string; visits: number }[];
};

export default function RelatoriosPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Indicador", "Valor"],
      ["Faturamento mensal", data.monthlyRevenue],
      ["Veículos atendidos", data.monthlyVehicles],
      ["Ticket médio", data.averageTicket],
      ["Resultado estimado", data.estimatedResult],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gomotors-relatorio.csv";
    a.click();
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando relatórios...</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Vendas, despesas e indicadores do período"
      >
        <Button variant="secondary" className="w-full sm:w-auto" onClick={exportCsv}>
          Exportar CSV (Excel)
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturamento mensal" value={formatCurrency(data.monthlyRevenue)} />
        <Stat label="Veículos atendidos" value={String(data.monthlyVehicles)} />
        <Stat label="Ticket médio" value={formatCurrency(data.averageTicket)} />
        <Stat label="Resultado estimado" value={formatCurrency(data.estimatedResult)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Serviços mais vendidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topServices.map((s) => (
              <div key={s.serviceName} className="flex justify-between text-sm">
                <span>{s.serviceName}</span>
                <span>{s._count.serviceName} vendas</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formas de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.paymentMethods.map((p) => (
              <div key={p.method} className="flex justify-between text-sm">
                <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                <span>{formatCurrency(p._sum.amount ?? 0)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.expensesByCategory.map((e) => (
              <div key={e.category} className="flex justify-between text-sm">
                <span>{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</span>
                <span>{formatCurrency(e._sum.amount ?? 0)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes que mais retornam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topClients.map((c) => (
              <div key={c.name} className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span>{c.visits} visitas</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas entregas do MVP</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>Geração de ordem de serviço em PDF</li>
            <li>Comparativo entre períodos no dashboard</li>
            <li>Estornos e cancelamentos com auditoria</li>
            <li>Histórico detalhado por veículo</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-bold sm:mt-2 sm:text-xl">{value}</p>
      </CardContent>
    </Card>
  );
}
