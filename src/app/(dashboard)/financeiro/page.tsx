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
  pendingByPayment: { method: string; amount: number }[];
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

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export default function FinanceiroPage() {
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [month, setMonth] = useState(currentMonthValue());
  const [day, setDay] = useState(todayInputValue());
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const autoMonth = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        viewMode === "day"
          ? `/api/finance?from=${encodeURIComponent(day)}&to=${encodeURIComponent(day)}`
          : `/api/finance?month=${encodeURIComponent(month)}`;
      const res = await fetch(url);
      const json = await res.json();

      if (
        viewMode === "month" &&
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
  }, [viewMode, month, day]);

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
        <Link href={viewMode === "day" ? `/caixa?date=${day}` : "/caixa"} className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Caixa do dia
          </Button>
        </Link>
        <Button variant="outline" className="w-full sm:w-auto" onClick={exportCsv}>
          Exportar CSV
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => setViewMode("month")}
          >
            Por mês
          </Button>
          <Button
            type="button"
            variant={viewMode === "day" ? "default" : "outline"}
            onClick={() => setViewMode("day")}
          >
            Por dia
          </Button>
        </div>
        {viewMode === "month" ? (
          <Field className="sm:w-56">
            <Label>Período (mês)</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        ) : (
          <Field className="sm:w-56">
            <Label>Dia</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDay((d) => shiftDate(d, -1))}
                aria-label="Dia anterior"
              >
                ‹
              </Button>
              <Input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDay((d) => shiftDate(d, 1))}
                aria-label="Próximo dia"
              >
                ›
              </Button>
            </div>
          </Field>
        )}
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
          title="Pagar depois"
          value={formatCurrency(data.pendingRevenue)}
          subtitle="A receber — não entra no lucro"
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

        {data.pendingByPayment.length > 0 && (
          <HorizontalBarChart
            title="Pagar depois (não entra no lucro)"
            items={data.pendingByPayment.map((p) => ({
              label: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
              value: p.amount,
            }))}
            formatValue={formatCurrency}
            colorClass="bg-amber-400"
          />
        )}

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
