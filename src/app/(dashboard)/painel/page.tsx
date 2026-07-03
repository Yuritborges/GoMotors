"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ExternalLink, Monitor } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { usePolling } from "@/lib/use-polling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockAlertsBanner } from "@/components/stock-alerts-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentModal } from "@/components/orders/payment-modal";

type Order = {
  id: string;
  status: string;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  entryAt: string;
  client: { id: string; name: string };
  vehicle: { plate: string };
  employee: { name: string } | null;
  items: { serviceName: string }[];
};

export default function PainelPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data.filter((o: Order) => o.status !== "ENTREGUE" && o.status !== "CANCELADO"));
    setLoading(false);
  }, []);

  usePolling(loadOrders, 3000);

  async function advanceStatus(orderId: string, currentStatus: string) {
    const idx = ORDER_STATUS_FLOW.indexOf(currentStatus as (typeof ORDER_STATUS_FLOW)[number]);
    if (idx === -1 || idx >= ORDER_STATUS_FLOW.length - 1) return;

    const nextStatus = ORDER_STATUS_FLOW[idx + 1];
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erro ao avançar status.");
      return;
    }

    await loadOrders();
  }

  async function deliverOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ENTREGUE" }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erro ao liberar veículo.");
      return;
    }

    await loadOrders();
  }

  async function bulkDeliver() {
    const readyCount = orders.filter((o) => o.status === "PRONTO" && o.paymentStatus === "PAGO").length;
    const pendingCount = orders.filter((o) => o.status === "PRONTO" && o.paymentStatus === "PENDENTE").length;

    if (readyCount === 0) {
      alert(
        pendingCount > 0
          ? "Nenhum veículo pronto e pago para liberar. Receba os pagamentos pendentes primeiro."
          : "Nenhum veículo pronto na fila."
      );
      return;
    }

    if (
      !confirm(
        `Liberar ${readyCount} veículo(s) pronto(s) e pago(s)?${
          pendingCount > 0 ? `\n\n${pendingCount} com pagamento pendente serão mantidos na fila.` : ""
        }`
      )
    ) {
      return;
    }

    setBulkLoading(true);
    const res = await fetch("/api/orders/bulk-deliver", { method: "POST" });
    const data = await res.json();
    setBulkLoading(false);

    if (!res.ok) {
      alert(data.error ?? "Erro ao zerar fila.");
      return;
    }

    alert(`${data.delivered} veículo(s) liberado(s).`);
    await loadOrders();
  }

  function handlePaid(orderId: string) {
    setPayOrder(null);
    void loadOrders();
    router.push(`/ordens/${orderId}/comprovante`);
  }

  const stats = {
    aguardando: orders.filter((o) => o.status === "AGUARDANDO").length,
    emAtendimento: orders.filter((o) =>
      ["EM_LAVAGEM", "FINALIZACAO"].includes(o.status)
    ).length,
    prontos: orders.filter((o) => o.status === "PRONTO").length,
    faturado: orders
      .filter((o) => o.paymentStatus === "PAGO")
      .reduce((sum, o) => sum + o.total, 0),
    pendente: orders
      .filter((o) => o.paymentStatus === "PENDENTE")
      .reduce((sum, o) => sum + o.total, 0),
  };

  const columns = ORDER_STATUS_FLOW.slice(0, 4);
  const readyOrders = orders.filter((o) => o.status === "PRONTO");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel operacional"
        description="Atualização automática a cada 3 segundos"
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {readyOrders.length > 0 && (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={bulkLoading}
              onClick={() => void bulkDeliver()}
            >
              {bulkLoading ? "Liberando..." : "Zerar fila (pagos)"}
            </Button>
          )}
          <Link href="/display" target="_blank" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <Monitor className="h-4 w-4 shrink-0" />
              <span className="truncate">Tela TV (clientes)</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </Button>
          </Link>
        </div>
      </PageHeader>

      <StockAlertsBanner />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Aguardando" value={stats.aguardando} />
        <Stat label="Em atendimento" value={stats.emAtendimento} />
        <Stat label="Prontos" value={stats.prontos} />
        <Stat label="Recebido hoje" value={formatCurrency(stats.faturado)} />
        <Stat label="Pendente" value={formatCurrency(stats.pendente)} />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map((status) => (
            <Card key={status}>
              <CardHeader>
                <CardTitle>{ORDER_STATUS_LABELS[status]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orders
                  .filter((o) => o.status === status)
                  .map((order) => (
                    <div
                      key={order.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{order.vehicle.plate}</p>
                          <p className="text-sm text-slate-600">{order.client.name}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {order.items.map((i) => i.serviceName).join(", ")}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span
                          className={
                            order.paymentStatus === "PENDENTE"
                              ? "font-medium text-amber-700"
                              : "text-emerald-700"
                          }
                        >
                          {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                        </span>
                        <span className="text-sm font-medium">{formatCurrency(order.total)}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Link href={`/ordens/${order.id}/comprovante`}>
                          <Button size="sm" variant="outline" className="w-full text-xs">
                            Comprovante
                          </Button>
                        </Link>

                        {status === "PRONTO" ? (
                          order.paymentStatus === "PENDENTE" ? (
                            <Button
                              className="w-full bg-amber-600 font-semibold text-white hover:bg-amber-700"
                              size="sm"
                              onClick={() => setPayOrder(order)}
                            >
                              Receber pagamento
                            </Button>
                          ) : (
                            <Button
                              className="w-full gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                              size="sm"
                              onClick={() => void deliverOrder(order.id)}
                            >
                              Liberar veículo
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )
                        ) : (
                          <Button
                            className="w-full gap-2 bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-700"
                            size="sm"
                            onClick={() => void advanceStatus(order.id, order.status)}
                          >
                            Avançar etapa
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                {orders.filter((o) => o.status === status).length === 0 && (
                  <p className="text-sm text-slate-400">Nenhum veículo</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {payOrder && (
        <PaymentModal
          order={payOrder}
          onClose={() => setPayOrder(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-5">
        <p className="text-xs text-slate-500 sm:text-sm">{label}</p>
        <p className="mt-1 text-lg font-bold sm:mt-2 sm:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}
