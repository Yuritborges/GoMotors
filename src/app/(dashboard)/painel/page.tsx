"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Monitor } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { isOwner } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { buildOperationalColumns } from "@/lib/display-lanes";
import type { DisplayOrderInput } from "@/lib/display-lanes-types";
import { DEFAULT_DISPLAY_LANE_DURATIONS, type DisplayLaneDurations } from "@/lib/shop-settings";
import {
  formatLaneClockTime,
  getLaneEstimatedEndAt,
  isLaneOverdue,
} from "@/lib/order-lane-duration";
import { getNextLaneLabel, isOrderInService, resolveOrderLane } from "@/lib/order-lanes";
import { usePolling } from "@/lib/use-polling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StockAlertsBanner } from "@/components/stock-alerts-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentModal } from "@/components/orders/payment-modal";
import {
  OrderServicesGrid,
  type OrderServiceLine,
} from "@/components/orders/order-services-grid";

type Order = {
  id: string;
  status: string;
  currentLane?: string | null;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  entryAt: string;
  laneEnteredAt?: string;
  client: { id: string; name: string };
  vehicle: { plate: string };
  employee: { name: string } | null;
  items: { serviceName: string; estimatedMinutes?: number; employee: { name: string } | null }[];
};

export default function PainelPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [laneDurations, setLaneDurations] = useState<DisplayLaneDurations>(
    DEFAULT_DISPLAY_LANE_DURATIONS
  );

  const owner = user ? isOwner(user.role) : false;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null));
  }, []);

  const [bulkLoading, setBulkLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    const [ordersRes, lanesRes] = await Promise.all([
      fetch("/api/orders"),
      fetch("/api/settings/display-lanes"),
    ]);
    const data = await ordersRes.json();
    setOrders(data.filter((o: Order) => o.status !== "ENTREGUE" && o.status !== "CANCELADO"));
    if (lanesRes.ok) {
      setLaneDurations(await lanesRes.json());
    }
    setLoading(false);
  }, []);

  usePolling(loadOrders, 3000);

  async function advanceOrder(order: Order) {
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advance: true }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erro ao avançar etapa.");
      return;
    }

    await loadOrders();
  }

  async function launchMonthlyAndDeliver(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/launch-monthly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliver: true }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erro ao lançar na mensalidade.");
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
    window.location.assign(`/ordens/${orderId}/comprovante?paid=1`);
  }

  const boardOrders: DisplayOrderInput[] = useMemo(
    () =>
      orders.map((o) => ({
        id: o.id,
        status: o.status,
        currentLane: o.currentLane,
        laneEnteredAt: new Date(o.laneEnteredAt ?? o.entryAt),
        client: o.client,
        vehicle: o.vehicle,
        items: o.items.map((item) => ({
          serviceName: item.serviceName,
          estimatedMinutes: item.estimatedMinutes ?? 20,
          employee: item.employee,
        })),
      })),
    [orders]
  );

  const columns = useMemo(
    () => buildOperationalColumns(boardOrders, laneDurations),
    [boardOrders, laneDurations]
  );

  const timingByOrderId = useMemo(() => {
    const map = new Map<
      string,
      { laneEnteredAt: string; estimatedMinutes: number }
    >();
    for (const col of columns) {
      if (col.lane === "AGUARDANDO" || col.lane === "PRONTO") continue;
      for (const entry of col.entries) {
        if (entry.estimatedMinutes <= 0) continue;
        map.set(entry.orderId, {
          laneEnteredAt: entry.laneEnteredAt,
          estimatedMinutes: entry.estimatedMinutes,
        });
      }
    }
    return map;
  }, [columns]);

  const stats = {
    aguardando: orders.filter((o) => resolveOrderLane(o) === "AGUARDANDO").length,
    emAtendimento: orders.filter((o) => isOrderInService(o)).length,
    prontos: orders.filter((o) => resolveOrderLane(o) === "PRONTO").length,
    faturado: orders
      .filter((o) => o.paymentStatus === "PAGO")
      .reduce((sum, o) => sum + o.total, 0),
    pendente: orders
      .filter((o) => o.paymentStatus === "PENDENTE")
      .reduce((sum, o) => sum + o.total, 0),
  };

  const readyOrders = orders.filter((o) => resolveOrderLane(o) === "PRONTO");

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

      <div className={`grid grid-cols-2 gap-3 ${owner ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
        <Stat label="Aguardando" value={stats.aguardando} />
        <Stat label="Em atendimento" value={stats.emAtendimento} />
        <Stat label="Prontos" value={stats.prontos} />
        {owner && (
          <>
            <Stat label="Recebido hoje" value={formatCurrency(stats.faturado)} />
            <Stat label="Pendente" value={formatCurrency(stats.pendente)} />
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div
            className="grid min-w-max gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(260px, 1fr))`,
            }}
          >
            {columns.map((col) => {
              const colOrders = orders.filter((o) => resolveOrderLane(o) === col.lane);
              return (
                <Card key={col.lane} className="min-w-[260px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{col.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {colOrders.map((order) => {
                      const nextLabel = getNextLaneLabel(resolveOrderLane(order), order.items);
                      const isReady = col.lane === "PRONTO";
                      const timing = timingByOrderId.get(order.id);
                      const laneEnteredAt = timing ? new Date(timing.laneEnteredAt) : null;
                      const estimatedEndAt =
                        timing && laneEnteredAt
                          ? getLaneEstimatedEndAt(laneEnteredAt, timing.estimatedMinutes)
                          : null;
                      const overdue =
                        timing &&
                        laneEnteredAt &&
                        isLaneOverdue(laneEnteredAt, timing.estimatedMinutes);

                      return (
                        <div
                          key={order.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div>
                            <p className="font-semibold">{order.vehicle.plate}</p>
                            <p className="text-sm text-slate-600">{order.client.name}</p>
                          </div>
                          <div className="mt-2">
                            <OrderServicesGrid
                              items={order.items.map(
                                (i): OrderServiceLine => ({
                                  serviceName: i.serviceName,
                                  employeeName: i.employee?.name ?? null,
                                })
                              )}
                            />
                          </div>
                          {timing && laneEnteredAt && estimatedEndAt && (
                            <p className="mt-2 text-xs tabular-nums text-slate-500">
                              Início{" "}
                              <span className="font-medium text-slate-700">
                                {formatLaneClockTime(laneEnteredAt)}
                              </span>
                              {" · "}
                              Previsão{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  overdue ? "text-red-600" : "text-slate-700"
                                )}
                              >
                                {formatLaneClockTime(estimatedEndAt)}
                              </span>
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span
                              className={
                                order.paymentStatus === "PENDENTE"
                                  ? order.paymentMethod === "FECHAMENTO_MENSAL"
                                    ? "font-medium text-violet-700"
                                    : "font-medium text-amber-700"
                                  : "text-emerald-700"
                              }
                            >
                              {order.paymentStatus === "PENDENTE" &&
                              order.paymentMethod === "FECHAMENTO_MENSAL"
                                ? "Mensalidade"
                                : (PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                                  order.paymentStatus)}
                            </span>
                            <span className="text-sm font-medium">
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            <Link href={`/ordens/${order.id}/comprovante`}>
                              <Button size="sm" variant="outline" className="w-full text-xs">
                                Comprovante
                              </Button>
                            </Link>

                            {isReady ? (
                              order.paymentStatus === "PENDENTE" ? (
                                order.paymentMethod === "FECHAMENTO_MENSAL" ? (
                                  <>
                                    <Button
                                      className="w-full gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                                      size="sm"
                                      onClick={() => void deliverOrder(order.id)}
                                    >
                                      Liberar veículo
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <p className="text-center text-[10px] text-violet-700">
                                      Mensalidade continua pendente até o fechamento.
                                    </p>
                                    <Button
                                      className="w-full bg-violet-600 font-semibold text-white hover:bg-violet-700"
                                      size="sm"
                                      onClick={() => setPayOrder(order)}
                                    >
                                      Receber fechamento
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      className="w-full bg-amber-600 font-semibold text-white hover:bg-amber-700"
                                      size="sm"
                                      onClick={() => setPayOrder(order)}
                                    >
                                      Receber pagamento
                                    </Button>
                                    <Button
                                      className="w-full gap-2 bg-violet-600 font-semibold text-white hover:bg-violet-700"
                                      size="sm"
                                      onClick={() => void launchMonthlyAndDeliver(order.id)}
                                    >
                                      Lançar na mensalidade e liberar
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </>
                                )
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
                                onClick={() => void advanceOrder(order)}
                              >
                                {nextLabel ? `Avançar → ${nextLabel}` : "Avançar etapa"}
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {colOrders.length === 0 && (
                      <p className="text-sm text-slate-400">Nenhum veículo</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
