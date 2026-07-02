"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import {
  DailyFlowChart,
  DreCard,
  FinanceKpiCard,
  HorizontalBarChart,
} from "@/components/finance/finance-charts";

type FinanceData = {
  period: { label: string };
  monthlyRevenue: number;
  monthlyVehicles: number;
  averageTicket: number;
  estimatedResult: number;
  revenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  revenueChangePercent: number | null;
  profitChangePercent: number | null;
  dailyFlow: { date: string; revenue: number; expenses: number; profit: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  paymentMethods: { method: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  topClients: { name: string; visits: number }[];
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
  pendingRevenue: number;
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function RelatoriosPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [data, setData] = useState<FinanceData | null>(null);
  const autoMonth = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance?month=${month}`);
    const json = await res.json();

    if (
      !autoMonth.current &&
      json.suggestedMonth &&
      json.suggestedMonth !== month &&
      json.revenue === 0 &&
      json.vehicleCount === 0
    ) {
      autoMonth.current = true;
      setMonth(json.suggestedMonth);
      return;
    }

    setData({
      ...json,
      monthlyRevenue: json.revenue,
      monthlyVehicles: json.vehicleCount,
      averageTicket: json.averageTicket,
      estimatedResult: json.profit,
      paymentMethods: json.revenueByPayment,
      topClients: json.topClients ?? [],
    });
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Indicador", "Valor"],
      ["Período", data.period.label],
      ["Faturamento", data.revenue],
      ["Despesas operacionais", data.operatingExpenses],
      ["Vales (funcionários)", data.employeeLedger.vales],
      ["Reembolsos (funcionários)", data.employeeLedger.reembolsos],
      ["Descontos (funcionários)", data.employeeLedger.descontos],
      ["Total despesas", data.expenses],
      ["Lucro", data.profit],
      ["Margem %", data.marginPercent],
      ["Veículos atendidos", data.monthlyVehicles],
      ["Ticket médio", data.averageTicket],
      [],
      ["Auditoria — Funcionários"],
      ["Nome", "Vales", "Reembolsos", "Descontos", "Impacto período", "Saldo acumulado"],
      ...data.employeeByPerson.map((e) => [
        e.name,
        e.vales,
        e.reembolsos,
        e.descontos,
        e.net,
        e.balance,
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gomotors-relatorio-${month}.csv`;
    a.click();
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando relatórios...</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description={`Auditoria financeira — ${data.period.label}`}>
        <Link href="/funcionarios">
          <Button variant="secondary" className="w-full sm:w-auto">
            Funcionários
          </Button>
        </Link>
        <Link href="/financeiro">
          <Button variant="secondary" className="w-full sm:w-auto">
            Financeiro completo
          </Button>
        </Link>
        <Button variant="outline" className="w-full sm:w-auto" onClick={exportCsv}>
          Exportar CSV
        </Button>
      </PageHeader>

      <Field className="max-w-xs">
        <Label>Mês</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinanceKpiCard
          title="Faturamento"
          value={formatCurrency(data.revenue)}
          trend={data.revenueChangePercent}
          variant="revenue"
        />
        <FinanceKpiCard
          title="Despesas"
          value={formatCurrency(data.expenses)}
          variant="expense"
        />
        <FinanceKpiCard
          title="Lucro"
          value={formatCurrency(data.profit)}
          trend={data.profitChangePercent}
          variant="profit"
        />
        <FinanceKpiCard
          title="Veículos"
          value={String(data.monthlyVehicles)}
          subtitle={`Ticket ${formatCurrency(data.averageTicket)}`}
        />
      </div>

      <DailyFlowChart points={data.dailyFlow} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DreCard
          revenue={data.revenue}
          expenses={data.expenses}
          profit={data.profit}
          pendingRevenue={data.pendingRevenue}
          operatingExpenses={data.operatingExpenses}
          employeeLedger={data.employeeLedger}
        />

        <HorizontalBarChart
          title="Serviços que mais faturaram"
          items={data.topServices.map((s) => ({
            label: `${s.name} (${s.count}x)`,
            value: s.revenue,
          }))}
          formatValue={formatCurrency}
        />

        <HorizontalBarChart
          title="Formas de pagamento"
          items={data.paymentMethods.map((p) => ({
            label: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
            value: p.amount,
          }))}
          formatValue={formatCurrency}
          colorClass="bg-emerald-500"
        />

        <HorizontalBarChart
          title="Despesas por categoria"
          items={data.expensesByCategory.map((e) => ({
            label: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
            value: e.amount,
          }))}
          formatValue={formatCurrency}
          colorClass="bg-red-400"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes que mais retornam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topClients.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados.</p>
            ) : (
              data.topClients.map((c) => (
                <div key={c.name} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{c.name}</span>
                  <span>{c.visits} visitas</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditoria — Funcionários (período)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.employeeByPerson.length === 0 ? (
            <p className="text-sm text-slate-500">Sem lançamentos de funcionários no período.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Vales</th>
                  <th className="pb-2 pr-4 font-medium">Reembolsos</th>
                  <th className="pb-2 pr-4 font-medium">Descontos</th>
                  <th className="pb-2 pr-4 font-medium">Impacto DRE</th>
                  <th className="pb-2 font-medium">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {data.employeeByPerson.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-4 font-medium">{e.name}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{formatCurrency(e.vales)}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{formatCurrency(e.reembolsos)}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-emerald-700">
                      {formatCurrency(e.descontos)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums font-semibold">
                      {formatCurrency(e.net)}
                    </td>
                    <td
                      className={`py-2.5 tabular-nums font-semibold ${
                        e.balance >= 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {formatCurrency(e.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2.5 pr-4">Total</td>
                  <td className="py-2.5 pr-4">{formatCurrency(data.employeeLedger.vales)}</td>
                  <td className="py-2.5 pr-4">{formatCurrency(data.employeeLedger.reembolsos)}</td>
                  <td className="py-2.5 pr-4">{formatCurrency(data.employeeLedger.descontos)}</td>
                  <td className="py-2.5 pr-4">{formatCurrency(data.employeeLedger.net)}</td>
                  <td className="py-2.5">—</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
