"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Monitor } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockAlertsBanner } from "@/components/stock-alerts-banner";
import { PageHeader } from "@/components/layout/page-header";

type Order = {
  id: string;
  status: string;
  total: number;
  entryAt: string;
  client: { name: string };
  vehicle: { plate: string };
  employee: { name: string } | null;
  items: { serviceName: string }[];
};

export default function PainelPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data.filter((o: Order) => o.status !== "ENTREGUE" && o.status !== "CANCELADO"));
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  async function advanceStatus(orderId: string, currentStatus: string) {
    const idx = ORDER_STATUS_FLOW.indexOf(currentStatus as (typeof ORDER_STATUS_FLOW)[number]);
    if (idx === -1 || idx >= ORDER_STATUS_FLOW.length - 1) return;

    const nextStatus = ORDER_STATUS_FLOW[idx + 1];
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    loadOrders();
  }

  const stats = {
    aguardando: orders.filter((o) => o.status === "AGUARDANDO").length,
    emAtendimento: orders.filter((o) =>
      ["EM_LAVAGEM", "FINALIZACAO"].includes(o.status)
    ).length,
    prontos: orders.filter((o) => o.status === "PRONTO").length,
    faturado: orders.reduce((sum, o) => sum + o.total, 0),
  };

  const columns = ORDER_STATUS_FLOW.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel operacional"
        description="Acompanhe os veículos do dia em tempo real"
      >
        <Link href="/display" target="_blank" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full gap-2 sm:w-auto">
            <Monitor className="h-4 w-4 shrink-0" />
            <span className="truncate">Tela TV (clientes)</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </Button>
        </Link>
      </PageHeader>

      <StockAlertsBanner />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aguardando" value={stats.aguardando} />
        <Stat label="Em atendimento" value={stats.emAtendimento} />
        <Stat label="Prontos" value={stats.prontos} />
        <Stat label="Faturado hoje" value={formatCurrency(stats.faturado)} />
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
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {formatCurrency(order.total)}
                          </span>
                          <Link href={`/ordens/${order.id}/comprovante`}>
                            <Button size="sm" variant="outline" className="text-xs">
                              Comprovante
                            </Button>
                          </Link>
                        </div>
                        {status !== "PRONTO" && (
                          <Button
                            className="w-full gap-2 bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-700"
                            size="sm"
                            onClick={() => advanceStatus(order.id, order.status)}
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

      <Card>
        <CardHeader>
          <CardTitle>Lista do dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold">{order.vehicle.plate}</p>
                    <p className="text-sm text-slate-600">{order.client.name}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {order.items.map((i) => i.serviceName).join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold">{formatCurrency(order.total)}</span>
                  <Link href={`/ordens/${order.id}/comprovante`}>
                    <Button size="sm">Comprovante</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Veículo</th>
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Serviço</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Valor</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium">{order.vehicle.plate}</td>
                  <td className="py-3 pr-4">{order.client.name}</td>
                  <td className="py-3 pr-4">
                    {order.items.map((i) => i.serviceName).join(", ")}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 pr-4">{formatCurrency(order.total)}</td>
                  <td className="py-3">
                    <Link href={`/ordens/${order.id}/comprovante`}>
                      <Button size="sm" variant="outline">Imprimir</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
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
