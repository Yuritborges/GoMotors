"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Unlock } from "lucide-react";

type DailyCashReport = {
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
  expenses: { description: string; category: string; amount: number }[];
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

export function CashClosingReportView({
  report,
  closedBy,
  closedAt,
  closed = false,
  onReopen,
  reopenLoading = false,
}: {
  report: DailyCashReport;
  closedBy?: string;
  closedAt?: string;
  closed?: boolean;
  onReopen?: () => void;
  reopenLoading?: boolean;
}) {
  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap">
        {closed && onReopen && (
          <Button
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            disabled={reopenLoading}
            onClick={onReopen}
          >
            <Unlock className="h-4 w-4" />
            {reopenLoading ? "Reabrindo..." : "Reabrir caixa"}
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          Gerar PDF (imprimir)
        </Button>
        <a href={`/api/cash/closings/${report.date}/export?format=xlsx`}>
          <Button variant="outline">Gerar Excel</Button>
        </a>
        <a href={`/api/cash/closings/${report.date}/export?format=csv`}>
          <Button variant="outline">Exportar CSV</Button>
        </a>
        <Link href="/caixa">
          <Button variant="secondary">Voltar ao caixa</Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Fechamento de Caixa</h1>
          <p className="mt-1 capitalize text-slate-600">{report.dateLabel}</p>
          {closedBy && (
            <p className="mt-1 text-sm text-slate-500">
              Fechado por {closedBy}
              {closedAt ? ` em ${formatDateTime(closedAt)}` : ""}
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Total recebido" value={formatCurrency(report.totalSold)} />
          <Kpi label="Despesas" value={formatCurrency(report.totalExpenses)} />
          <Kpi label="Funcionários" value={formatCurrency(report.employeeExpenses)} />
          <Kpi label="Lucro estimado" value={formatCurrency(report.estimatedResult)} highlight />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formas de pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(report.byPaymentMethod).map(([method, amount]) => (
                <div key={method} className="flex justify-between">
                  <span>{PAYMENT_METHOD_LABELS[method] ?? method}</span>
                  <span className="font-semibold">{formatCurrency(amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indicadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Veículos atendidos" value={String(report.vehicleCount)} />
              <Row label="Pagos" value={String(report.paidCount)} />
              <Row label="Pendentes" value={String(report.pendingPaymentCount)} />
              <Row label="Ticket médio" value={formatCurrency(report.averageTicket)} />
              <Row label="A receber" value={formatCurrency(report.pendingAmount)} />
              <Row label="Pagar depois" value={formatCurrency(report.payLaterAmount)} />
              <Row label="Descontos" value={formatCurrency(report.totalDiscounts)} />
            </CardContent>
          </Card>
        </div>

        {report.expenses.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Despesas do dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.expenses.map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {e.description}{" "}
                    <span className="text-slate-500">
                      ({EXPENSE_CATEGORY_LABELS[e.category] ?? e.category})
                    </span>
                  </span>
                  <span className="font-semibold">{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">
              Movimentação ({report.todayOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-3">Hora</th>
                  <th className="pb-2 pr-3">Placa</th>
                  <th className="pb-2 pr-3">Cliente</th>
                  <th className="pb-2 pr-3">Serviços</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Pagamento</th>
                  <th className="pb-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {report.todayOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDateTime(o.entryAt).split(" ")[1]}
                    </td>
                    <td className="py-2 pr-3 font-semibold">{o.plate}</td>
                    <td className="py-2 pr-3">{o.clientName}</td>
                    <td className="max-w-[140px] truncate py-2 pr-3">{o.services}</td>
                    <td className="py-2 pr-3">{ORDER_STATUS_LABELS[o.status] ?? o.status}</td>
                    <td className="py-2 pr-3">
                      {PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus}
                      {o.paymentStatus === "PAGO" &&
                        ` · ${PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}`}
                    </td>
                    <td className="py-2 font-semibold">{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function CashClosingReportLoader({ date }: { date: string }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<{
    report: DailyCashReport;
    closed: boolean;
    closedBy?: string;
    createdAt?: string;
  } | null>(null);

  async function loadReport() {
    const res = await fetch(`/api/cash/closings/${date}`);
    const data = await res.json();
    setPayload(data);
  }

  useEffect(() => {
    void loadReport().finally(() => setLoading(false));
  }, [date]);

  async function reopenCashDay() {
    if (
      !confirm(
        `Reabrir o caixa de ${payload?.report.dateLabel ?? date}?\n\nVocê poderá alterar lançamentos e fechar novamente.`
      )
    ) {
      return;
    }
    setReopenLoading(true);
    setError("");
    const res = await fetch("/api/cash/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const json = await res.json();
    setReopenLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao reabrir caixa.");
      return;
    }
    window.location.href = `/caixa?date=${date}`;
  }

  useEffect(() => {
    if (searchParams.get("print") === "1" && payload?.report) {
      setTimeout(() => window.print(), 400);
    }
  }, [searchParams, payload]);

  if (loading) return <p className="text-sm text-slate-500">Carregando relatório...</p>;
  if (!payload?.report) return <p className="text-sm text-red-600">Relatório não encontrado.</p>;

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 print:hidden">
          {error}
        </p>
      )}
      <CashClosingReportView
        report={payload.report}
        closedBy={payload.closedBy}
        closedAt={payload.createdAt}
        closed={payload.closed}
        onReopen={payload.closed ? () => void reopenCashDay() : undefined}
        reopenLoading={reopenLoading}
      />
    </>
  );
}
