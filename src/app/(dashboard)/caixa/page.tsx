"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Car,
  Clock,
  CreditCard,
  PiggyBank,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { usePolling } from "@/lib/use-polling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

type CashData = {
  totalSold: number;
  totalDiscounts: number;
  pendingAmount: number;
  vehicleCount: number;
  paidCount: number;
  pendingPaymentCount: number;
  averageTicket: number;
  byPaymentMethod: Record<string, number>;
  totalExpenses: number;
  estimatedResult: number;
  pendingOrders: {
    id: string;
    total: number;
    status: string;
    plate: string;
    clientName: string;
  }[];
};

const METHOD_ICONS: Record<string, typeof Wallet> = {
  DINHEIRO: Banknote,
  PIX: Wallet,
  DEBITO: CreditCard,
  CREDITO: CreditCard,
};

const METHOD_COLORS: Record<string, string> = {
  DINHEIRO: "from-emerald-500 to-emerald-600",
  PIX: "from-sky-500 to-sky-600",
  DEBITO: "from-violet-500 to-violet-600",
  CREDITO: "from-indigo-500 to-indigo-600",
};

export default function CaixaPage() {
  const [data, setData] = useState<CashData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/cash");
    if (res.ok) setData(await res.json());
  }, []);

  usePolling(load, 30000);

  async function manualRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando fechamento...</p>;
  }

  const methodTotal = Object.values(data.byPaymentMethod).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Caixa" description="Fechamento diário em tempo real">
        <Button
          variant="outline"
          className="gap-2"
          disabled={refreshing}
          onClick={() => void manualRefresh()}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          label="Total recebido"
          value={formatCurrency(data.totalSold)}
          accent="text-emerald-600 bg-emerald-50"
        />
        <MetricCard
          icon={Car}
          label="Veículos atendidos"
          value={String(data.vehicleCount)}
          sub={`${data.paidCount} pagos`}
          accent="text-sky-600 bg-sky-50"
        />
        <MetricCard
          icon={PiggyBank}
          label="Ticket médio"
          value={formatCurrency(data.averageTicket)}
          accent="text-violet-600 bg-violet-50"
        />
        <MetricCard
          icon={Clock}
          label="Pendente"
          value={formatCurrency(data.pendingAmount)}
          sub={`${data.pendingPaymentCount} ordem(ns)`}
          accent="text-amber-600 bg-amber-50"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Formas de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.byPaymentMethod).length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum pagamento registrado hoje.</p>
            ) : (
              Object.entries(data.byPaymentMethod).map(([method, amount]) => {
                const Icon = METHOD_ICONS[method] ?? Wallet;
                const pct = methodTotal > 0 ? (amount / methodTotal) * 100 : 0;
                return (
                  <div key={method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={`inline-flex rounded-lg bg-gradient-to-br p-1.5 text-white ${METHOD_COLORS[method] ?? "from-slate-500 to-slate-600"}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {PAYMENT_METHOD_LABELS[method] ?? method}
                      </span>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${METHOD_COLORS[method] ?? "from-slate-400 to-slate-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-right text-xs text-slate-400">{pct.toFixed(0)}%</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow label="Descontos aplicados" value={formatCurrency(data.totalDiscounts)} />
            <SummaryRow label="Despesas do dia" value={formatCurrency(data.totalExpenses)} />
            <SummaryRow
              label="Resultado estimado"
              value={formatCurrency(data.estimatedResult)}
              highlight
            />
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Resultado = recebido − despesas. Valores pendentes não entram no total recebido.
            </div>
          </CardContent>
        </Card>
      </div>

      {data.pendingOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{order.plate}</p>
                    <p className="text-sm text-slate-600">{order.clientName}</p>
                    <p className="text-xs text-slate-500">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                    <Link href="/painel">
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                        Receber no painel
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className={`mb-3 inline-flex rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold sm:text-2xl">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
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
      className={`flex justify-between text-sm ${highlight ? "rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-900" : ""}`}
    >
      <span className={highlight ? "" : "text-slate-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
