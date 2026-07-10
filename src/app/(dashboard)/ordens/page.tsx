"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { businessDateKey, formatBusinessDateKey } from "@/lib/business-day";
import { usePolling } from "@/lib/use-polling";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

type Order = {
  id: string;
  status: string;
  total: number;
  paymentStatus: string;
  entryAt: string;
  client: { name: string };
  vehicle: { plate: string };
  items: { serviceName: string }[];
};

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function OrdensPage() {
  const [date, setDate] = useState(() => businessDateKey());
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!isValidDateKey(date)) {
      setOrders([]);
      return;
    }
    const res = await fetch(`/api/orders?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      setOrders([]);
      return;
    }
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
  }, [date]);

  usePolling(loadOrders, 10000);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsOwner(data?.user?.role === "PROPRIETARIO"));
  }, []);

  async function deleteOrder(order: Order) {
    const msg = `Tem certeza que deseja excluir a ordem de ${order.vehicle.plate} (${order.client.name})?\n\nEsta ação remove a ordem dos relatórios, financeiro e base de dados. Não pode ser desfeita.`;
    if (!confirm(msg)) return;

    setDeletingId(order.id);
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    setDeletingId(null);

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erro ao excluir ordem.");
      return;
    }

    await loadOrders();
  }

  const todayKey = businessDateKey();
  const isToday = date === todayKey;
  const dateLabel = isToday ? "hoje" : formatBusinessDateKey(date);
  const novaOrdemHref =
    date === todayKey ? "/ordens/nova" : `/ordens/nova?operatingDate=${encodeURIComponent(date)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de serviço"
        description={`Ordens operacionais de ${dateLabel}`}
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => {
              const value = e.target.value;
              if (isValidDateKey(value)) setDate(value);
            }}
            className="h-10 w-full sm:w-auto"
          />
          <Link href={novaOrdemHref} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Nova ordem</Button>
          </Link>
        </div>
      </PageHeader>

      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{order.vehicle.plate}</p>
                  <p className="text-sm text-slate-600">{order.client.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(order.entryAt)}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {order.items.map((i) => i.serviceName).join(", ")}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                <div className="flex gap-2">
                  <Link href={`/ordens/${order.id}/comprovante`}>
                    <Button size="sm">Comprovante</Button>
                  </Link>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      disabled={deletingId === order.id}
                      onClick={() => void deleteOrder(order)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            Nenhuma ordem operacional em {dateLabel}.
          </p>
        )}
      </div>

      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Entrada</th>
                <th className="pb-3 pr-4 font-medium">Veículo</th>
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Serviços</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Total</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{formatDateTime(order.entryAt)}</td>
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
                    <div className="flex gap-2">
                      <Link href={`/ordens/${order.id}/comprovante`}>
                        <Button size="sm">Comprovante</Button>
                      </Link>
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          disabled={deletingId === order.id}
                          onClick={() => void deleteOrder(order)}
                        >
                          {deletingId === order.id ? "..." : "Excluir"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma ordem operacional em {dateLabel}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
