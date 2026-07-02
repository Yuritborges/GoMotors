"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import {
  DailyFlowChart,
  DreCard,
  FinanceKpiCard,
  HorizontalBarChart,
} from "@/components/finance/finance-charts";

type FinanceData = {
  period: { label: string };
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
  dailyFlow: { date: string; revenue: number; expenses: number; profit: number }[];
  expensesByCategory: { category: string; amount: number }[];
  revenueByPayment: { method: string; amount: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  employeeLedger: {
    vales: number;
    reembolsos: number;
    descontos: number;
    net: number;
  };
  operatingExpenses: number;
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

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceiroPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const autoMonth = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
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

      setData(json);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Go Motors — Financeiro", data.period.label],
      [],
      ["Receita", data.revenue],
      ["Despesas", data.expenses],
      ["Lucro", data.profit],
      ["Margem %", data.marginPercent],
      ["Veículos", data.vehicleCount],
      ["Ticket médio", data.averageTicket],
      [],
      ["Despesas por categoria"],
      ...data.expensesByCategory.map((e) => [
        EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        e.amount,
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gomotors-financeiro-${month}.csv`;
    a.click();
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Carregando financeiro...</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">Erro ao carregar dados financeiros.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description={`Go Motors — ${data.period.label}`}
      >
        <Link href="/despesas" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            + Despesa
          </Button>
        </Link>
        <Link href="/caixa" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Caixa do dia
          </Button>
        </Link>
        <Button variant="outline" className="w-full sm:w-auto" onClick={exportCsv}>
          Exportar CSV
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="sm:w-56">
          <Label>Período (mês)</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        <p className="text-sm text-slate-500">
          {data.paidOrderCount} ordens pagas · {data.vehicleCount} veículos no período
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinanceKpiCard
          title="Receita"
          value={formatCurrency(data.revenue)}
          subtitle={`Ticket médio ${formatCurrency(data.averageTicket)}`}
          trend={data.revenueChangePercent}
          variant="revenue"
        />
        <FinanceKpiCard
          title="Despesas"
          value={formatCurrency(data.expenses)}
          trend={data.expenseChangePercent}
          variant="expense"
        />
        <FinanceKpiCard
          title="Lucro líquido"
          value={formatCurrency(data.profit)}
          subtitle={`Margem ${data.marginPercent}%`}
          trend={data.profitChangePercent}
          variant="profit"
        />
        <FinanceKpiCard
          title="A receber"
          value={formatCurrency(data.pendingRevenue)}
          subtitle="Ordens pendentes de pagamento"
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
          title="Despesas por categoria"
          items={data.expensesByCategory.map((e) => ({
            label: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
            value: e.amount,
          }))}
          formatValue={formatCurrency}
          colorClass="bg-red-400"
        />

        <HorizontalBarChart
          title="Receita por forma de pagamento"
          items={data.revenueByPayment.map((p) => ({
            label: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
            value: p.amount,
          }))}
          formatValue={formatCurrency}
          colorClass="bg-emerald-500"
        />

        <HorizontalBarChart
          title="Serviços que mais faturaram"
          items={data.topServices.map((s) => ({
            label: `${s.name} (${s.count}x)`,
            value: s.revenue,
          }))}
          formatValue={formatCurrency}
          colorClass="bg-sky-500"
        />
      </div>
    </div>
  );
}
