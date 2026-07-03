"use client";

import { useEffect, useState } from "react";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { SETTLEMENT_PAYMENT_METHODS } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PendingSummary = {
  count: number;
  totalAmount: number;
  orders: {
    id: string;
    plate: string;
    total: number;
    entryAt: string;
    services: string[];
  }[];
};

type PaymentModalProps = {
  order: {
    id: string;
    total: number;
    paymentMethod?: string;
    client: { id: string; name: string };
    vehicle: { plate: string };
  };
  onClose: () => void;
  onPaid: (orderId: string) => void;
};

type PayMode = "single" | "fechamento";

export function PaymentModal({ order, onClose, onPaid }: PaymentModalProps) {
  const [mode, setMode] = useState<PayMode>(
    order.paymentMethod === "FECHAMENTO_MENSAL" ? "fechamento" : "single"
  );
  const [method, setMethod] = useState("PIX");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingSummary | null>(null);
  const [loadingPending, setLoadingPending] = useState(false);

  const alreadyMonthly = order.paymentMethod === "FECHAMENTO_MENSAL";

  useEffect(() => {
    if (mode !== "fechamento") return;

    setLoadingPending(true);
    fetch(`/api/clients/${order.client.id}/pending-payments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.orders) setPending(data);
        else setError(data.error ?? "Erro ao buscar pendências.");
      })
      .catch(() => setError("Erro ao buscar pendências do cliente."))
      .finally(() => setLoadingPending(false));
  }, [mode, order.client.id]);

  const fechamentoTotal = pending?.totalAmount ?? 0;
  const fechamentoCount = pending?.count ?? 0;
  const displayTotal = mode === "single" ? order.total : fechamentoTotal;

  async function handleLaunchMonthly() {
    setSaving(true);
    setError("");

    const res = await fetch(`/api/orders/${order.id}/launch-monthly`, {
      method: "POST",
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao lançar na mensalidade.");
      return;
    }

    onPaid(order.id);
  }

  async function handlePay() {
    setSaving(true);
    setError("");

    if (mode === "fechamento") {
      if (!pending || pending.count === 0) {
        setError("Nenhum serviço pendente para este cliente.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/orders/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: order.client.id,
          settlementMethod: method,
        }),
      });
      const data = await res.json();
      setSaving(false);

      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar fechamento.");
        return;
      }

      onPaid(order.id);
      return;
    }

    const res = await fetch(`/api/orders/${order.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: method }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar pagamento.");
      return;
    }

    onPaid(order.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl">
        <CardHeader>
          <CardTitle>Receber pagamento</CardTitle>
          <p className="text-sm text-slate-600">
            {order.vehicle.plate} · {order.client.name}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 py-2.5 text-sm font-medium touch-manipulation",
                mode === "single"
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              )}
            >
              Só esta OS
            </button>
            <button
              type="button"
              onClick={() => setMode("fechamento")}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 py-2.5 text-sm font-medium touch-manipulation",
                mode === "fechamento"
                  ? "border-violet-500 bg-violet-600 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              )}
            >
              Fechamento mensal
            </button>
          </div>

          {mode === "fechamento" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-sm text-violet-950">
                <p className="font-semibold">Conta mensal do cliente</p>
                <p className="mt-1 text-xs text-violet-800">
                  <strong>Lançar na mensalidade</strong> — o cliente leva o carro e paga no fim do
                  mês. <strong>Receber fechamento</strong> — quando ele vier quitar todas as OS
                  pendentes de uma vez.
                </p>
              </div>

              {!alreadyMonthly && (
                <div className="rounded-xl border border-violet-300 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Lançar esta OS na mensalidade
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatCurrency(order.total)} · {order.vehicle.plate} entra na conta do mês.
                    Libere o veículo sem receber agora.
                  </p>
                  <Button
                    className="mt-3 w-full bg-violet-600 hover:bg-violet-700"
                    disabled={saving}
                    onClick={() => void handleLaunchMonthly()}
                  >
                    {saving ? "Lançando..." : "Lançar na mensalidade"}
                  </Button>
                </div>
              )}

              {alreadyMonthly && (
                <p className="rounded-lg bg-violet-100 px-3 py-2 text-sm text-violet-900">
                  Esta OS já está na mensalidade. Libere o veículo ou receba o fechamento abaixo.
                </p>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Cliente pagando agora</span>
                </div>
              </div>
            </div>
          )}

          {mode === "fechamento" && loadingPending && (
            <p className="text-sm text-slate-500">Calculando pendências...</p>
          )}

          {mode === "fechamento" && pending && !loadingPending && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{fechamentoCount} serviço(s) em aberto</span>
                <span>{formatCurrency(fechamentoTotal)}</span>
              </div>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {pending.orders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between font-medium">
                      <span>{o.plate}</span>
                      <span>{formatCurrency(o.total)}</span>
                    </div>
                    <p className="text-slate-500">{o.services.join(", ")}</p>
                    <p className="text-slate-400">{formatDateTime(o.entryAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(mode === "single" || mode === "fechamento") && (
            <div>
              <p className="mb-1 text-xs text-slate-500">
                {mode === "fechamento" ? "Total do fechamento" : "Valor desta OS"}
              </p>
              <p className="text-2xl font-bold">{formatCurrency(displayTotal)}</p>
            </div>
          )}

          {(mode === "single" || mode === "fechamento") && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">
                {mode === "fechamento"
                  ? "Como o cliente está pagando o fechamento?"
                  : "Como o cliente pagou?"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SETTLEMENT_PAYMENT_METHODS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={cn(
                      "min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium touch-manipulation",
                      method === key
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={
                saving ||
                (mode === "fechamento" &&
                  (loadingPending || !pending || pending.count === 0))
              }
              onClick={() => void handlePay()}
            >
              {saving
                ? "Registrando..."
                : mode === "fechamento"
                  ? `Quitar ${fechamentoCount} serviço(s)`
                  : "Confirmar pagamento"}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
