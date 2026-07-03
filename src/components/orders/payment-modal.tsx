"use client";

import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { isDeferredPaymentMethod } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PaymentModalProps = {
  order: {
    id: string;
    total: number;
    vehicle: { plate: string };
    client: { name: string };
  };
  onClose: () => void;
  onPaid: (orderId: string) => void;
};

export function PaymentModal({ order, onClose, onPaid }: PaymentModalProps) {
  const [method, setMethod] = useState("PIX");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setSaving(true);
    setError("");
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
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Receber pagamento</CardTitle>
          <p className="text-sm text-slate-600">
            {order.vehicle.plate} · {order.client.name}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-bold">{formatCurrency(order.total)}</p>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PAYMENT_METHOD_LABELS)
              .filter(([key]) => !isDeferredPaymentMethod(key))
              .map(([key, label]) => (
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
                  {label}
                </button>
              ))}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={saving}
              onClick={() => void handlePay()}
            >
              {saving ? "Registrando..." : "Confirmar pagamento"}
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
