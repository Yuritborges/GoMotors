"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { usePolling } from "@/lib/use-polling";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/orders/payment-modal";

type PendingClient = {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  orderCount: number;
  totalAmount: number;
  monthlyAmount: number;
  payLaterAmount: number;
  primaryMethod: "FECHAMENTO_MENSAL" | "PAGAR_DEPOIS" | "MIXED";
  orders: {
    id: string;
    plate: string;
    total: number;
    status: string;
    paymentMethod: string;
    entryAt: string;
    services: string[];
  }[];
};

type RecentSettlement = {
  clientId: string;
  clientName: string;
  amount: number;
  method: string;
  paidAt: string;
  plates: string[];
  orderCount: number;
  isMonthlyClosing: boolean;
};

type PendingData = {
  summary: {
    clientCount: number;
    orderCount: number;
    totalAmount: number;
    monthlyAmount: number;
    payLaterAmount: number;
  };
  debtors: PendingClient[];
  recentSettlements: RecentSettlement[];
};

function methodBadge(client: PendingClient) {
  if (client.primaryMethod === "FECHAMENTO_MENSAL") {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
        Mensalidade
      </span>
    );
  }
  if (client.primaryMethod === "PAGAR_DEPOIS") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        Pagar depois
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
      Misto
    </span>
  );
}

export default function PendenciasPage() {
  const [data, setData] = useState<PendingData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payClient, setPayClient] = useState<PendingClient | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/pending-payments");
    if (res.ok) setData(await res.json());
  }, []);

  usePolling(load, 15000);

  async function manualRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handlePaid() {
    setPayClient(null);
    void load();
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando pendências...</p>;
  }

  const anchorOrder = payClient?.orders[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos pendentes"
        description="Clientes devedores e quitações do dia"
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/caixa">
            <Button variant="outline" className="w-full sm:w-auto">
              Voltar ao caixa
            </Button>
          </Link>
          <Button
            variant="secondary"
            className="w-full gap-2 sm:w-auto"
            disabled={refreshing}
            onClick={() => void manualRefresh()}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devedores" value={String(data.summary.clientCount)} />
        <StatCard label="OS em aberto" value={String(data.summary.orderCount)} />
        <StatCard label="Total a receber" value={formatCurrency(data.summary.totalAmount)} />
        <StatCard
          label="Mensalidades"
          value={formatCurrency(data.summary.monthlyAmount)}
          sub={`${formatCurrency(data.summary.payLaterAmount)} pagar depois`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes com pendências</CardTitle>
          <p className="text-sm text-slate-500">
            Toque em <strong>Quitar conta</strong> para receber o fechamento mensal ou todas as OS
            em aberto do cliente.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.debtors.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhum pagamento pendente no momento.
            </p>
          ) : (
            data.debtors.map((client) => {
              const isOpen = expanded === client.clientId;
              return (
                <div
                  key={client.clientId}
                  className="rounded-xl border border-amber-200 bg-amber-50/40"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-slate-900">{client.clientName}</p>
                        {methodBadge(client)}
                      </div>
                      {client.clientPhone && (
                        <p className="text-sm text-slate-600">{client.clientPhone}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-600">
                        {client.orderCount} serviço(s) ·{" "}
                        {client.orders.map((o) => o.plate).join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <p className="text-right text-2xl font-bold text-amber-900">
                        {formatCurrency(client.totalAmount)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpanded(isOpen ? null : client.clientId)
                          }
                        >
                          {isOpen ? (
                            <>
                              Ocultar <ChevronUp className="ml-1 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Detalhes <ChevronDown className="ml-1 h-4 w-4" />
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setPayClient(client)}
                        >
                          Quitar conta
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="space-y-2 border-t border-amber-200 px-4 pb-4 pt-3">
                      {client.orders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-lg border border-white bg-white px-3 py-2 text-sm"
                        >
                          <div className="flex justify-between font-semibold">
                            <span>{order.plate}</span>
                            <span>{formatCurrency(order.total)}</span>
                          </div>
                          <p className="text-slate-600">{order.services.join(" · ")}</p>
                          <p className="text-xs text-slate-400">
                            {formatDateTime(order.entryAt)} ·{" "}
                            {ORDER_STATUS_LABELS[order.status] ?? order.status} ·{" "}
                            {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quitados hoje</CardTitle>
          <p className="text-sm text-slate-500">
            Clientes que já pagaram ou fizeram fechamento mensual hoje.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentSettlements.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nenhuma quitação registrada hoje ainda.
            </p>
          ) : (
            data.recentSettlements.map((item, index) => (
              <div
                key={`${item.clientId}-${item.paidAt}-${index}`}
                className="flex flex-col gap-1 rounded-lg bg-emerald-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-emerald-950">{item.clientName}</p>
                  <p className="text-xs text-emerald-800">
                    {item.isMonthlyClosing
                      ? `Fechamento mensal · ${item.orderCount} OS`
                      : `${item.orderCount} pagamento(s)`}{" "}
                    · {item.plates.join(", ")}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-bold text-emerald-900">{formatCurrency(item.amount)}</p>
                  <p className="text-xs text-emerald-700">
                    {PAYMENT_METHOD_LABELS[item.method] ?? item.method} ·{" "}
                    {formatDateTime(item.paidAt).split(" ")[1]}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {payClient && anchorOrder && (
        <PaymentModal
          order={{
            id: anchorOrder.id,
            total: payClient.totalAmount,
            paymentMethod:
              payClient.primaryMethod === "PAGAR_DEPOIS"
                ? "PAGAR_DEPOIS"
                : "FECHAMENTO_MENSAL",
            client: { id: payClient.clientId, name: payClient.clientName },
            vehicle: { plate: anchorOrder.plate },
          }}
          onClose={() => setPayClient(null)}
          onPaid={handlePaid}
          defaultMode="fechamento"
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-bold">{value}</p>
        {sub && <p className="mt-1 text-[10px] text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}
