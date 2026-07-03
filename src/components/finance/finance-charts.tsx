"use client";

import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FinanceKpiCard({
  title,
  value,
  subtitle,
  trend,
  variant = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  variant?: "default" | "revenue" | "expense" | "profit";
}) {
  const borders = {
    default: "border-slate-200",
    revenue: "border-emerald-200 bg-emerald-50/40",
    expense: "border-red-200 bg-red-50/40",
    profit: "border-sky-200 bg-sky-50/40",
  };

  return (
    <Card className={cn(borders[variant])}>
      <CardContent className="pt-5">
        <p className="text-xs text-slate-500 sm:text-sm">{title}</p>
        <p className="mt-1 text-lg font-bold text-slate-900 sm:text-2xl">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        {trend != null && (
          <p
            className={cn(
              "mt-2 text-xs font-medium",
              trend >= 0 ? "text-emerald-600" : "text-red-600"
            )}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs mês anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function HorizontalBarChart({
  title,
  items,
  formatValue = (v) => String(v),
  colorClass = "bg-sky-500",
}: {
  title: string;
  items: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  colorClass?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Sem dados no período.</p>
        ) : (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="truncate pr-2">{item.label}</span>
                <span className="shrink-0 font-medium">{formatValue(item.value)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full transition-all", colorClass)}
                  style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DailyFlowChart({
  points,
}: {
  points: { date: string; revenue: number; expenses: number; profit: number }[];
}) {
  const recent = points.filter((p) => p.revenue > 0 || p.expenses > 0).slice(-14);
  const max = Math.max(...recent.flatMap((p) => [p.revenue, p.expenses]), 1);

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo diário</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Sem movimentação no período.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fluxo diário</CardTitle>
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Receita
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Despesas
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 overflow-x-auto pb-2 sm:gap-2">
          {recent.map((p) => {
            const day = p.date.slice(8, 10);
            const revH = Math.round((p.revenue / max) * 100);
            const expH = Math.round((p.expenses / max) * 100);
            return (
              <div
                key={p.date}
                className="flex min-w-[2rem] flex-1 flex-col items-center gap-1"
                title={`${p.date}\nReceita: ${formatCurrency(p.revenue)}\nDespesas: ${formatCurrency(p.expenses)}\nLucro: ${formatCurrency(p.profit)}`}
              >
                <div className="flex h-24 w-full items-end justify-center gap-0.5 sm:h-32">
                  <div
                    className="w-2 rounded-t bg-emerald-500 sm:w-3"
                    style={{ height: `${Math.max(revH, 4)}%` }}
                  />
                  <div
                    className="w-2 rounded-t bg-red-400 sm:w-3"
                    style={{ height: `${Math.max(expH, p.expenses > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 sm:text-xs">{day}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function DreCard({
  revenue,
  expenses,
  profit,
  pendingRevenue,
  operatingExpenses,
  employeeLedger,
}: {
  revenue: number;
  expenses: number;
  profit: number;
  pendingRevenue: number;
  operatingExpenses?: number;
  employeeLedger?: {
    vales: number;
    reembolsos: number;
    descontos: number;
    net: number;
  };
}) {
  const rows = [
    { label: "(+) Receita recebida", value: revenue, positive: true },
    { label: "(+) A receber — pagar depois", value: pendingRevenue, positive: true, muted: true },
    ...(operatingExpenses != null
      ? [{ label: "(−) Despesas operacionais", value: operatingExpenses, positive: false }]
      : []),
    ...(employeeLedger &&
    (employeeLedger.vales > 0 || employeeLedger.reembolsos > 0 || employeeLedger.descontos > 0)
      ? [
          ...(employeeLedger.vales > 0
            ? [{ label: "(−) Vales (funcionários)", value: employeeLedger.vales, positive: false }]
            : []),
          ...(employeeLedger.reembolsos > 0
            ? [
                {
                  label: "(−) Reembolsos (funcionários)",
                  value: employeeLedger.reembolsos,
                  positive: false,
                },
              ]
            : []),
          ...(employeeLedger.descontos > 0
            ? [
                {
                  label: "(+) Descontos (funcionários)",
                  value: employeeLedger.descontos,
                  positive: true,
                },
              ]
            : []),
        ]
      : []),
    ...(operatingExpenses == null
      ? [{ label: "(−) Despesas", value: expenses, positive: false }]
      : [{ label: "(−) Total despesas", value: expenses, positive: false, bold: false }]),
    { label: "(=) Lucro líquido", value: profit, positive: profit >= 0, bold: true },
  ] as {
    label: string;
    value: number;
    positive: boolean;
    muted?: boolean;
    bold?: boolean;
  }[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demonstrativo do período (DRE)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingRevenue > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Valores &quot;pagar depois&quot; não entram no lucro até a baixa do pagamento.
          </p>
        )}
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm",
              row.bold ? "bg-slate-900 text-white" : "bg-slate-50",
              row.muted && "opacity-80"
            )}
          >
            <span className={row.bold ? "font-semibold" : ""}>{row.label}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                !row.bold && row.positive && row.value > 0 && "text-emerald-700",
                !row.bold && !row.positive && "text-red-600"
              )}
            >
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
