"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

type CashData = {
  totalSold: number;
  totalDiscounts: number;
  pendingAmount: number;
  vehicleCount: number;
  pendingPaymentCount: number;
  byPaymentMethod: Record<string, number>;
  totalExpenses: number;
  estimatedResult: number;
};

export default function CaixaPage() {
  const [data, setData] = useState<CashData | null>(null);

  useEffect(() => {
    fetch("/api/cash")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando fechamento...</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Caixa" description="Fechamento diário" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Total vendido" value={formatCurrency(data.totalSold)} />
        <Stat title="Veículos atendidos" value={String(data.vehicleCount)} />
        <Stat title="Descontos" value={formatCurrency(data.totalDiscounts)} />
        <Stat title="Pendente" value={formatCurrency(data.pendingAmount)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.byPaymentMethod).length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum pagamento registrado.</p>
            ) : (
              Object.entries(data.byPaymentMethod).map(([method, amount]) => (
                <div
                  key={method}
                  className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm"
                >
                  <span>{PAYMENT_METHOD_LABELS[method] ?? method}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo do dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Serviços pendentes de pagamento" value={String(data.pendingPaymentCount)} />
            <Row label="Despesas do dia" value={formatCurrency(data.totalExpenses)} />
            <Row
              label="Resultado operacional estimado"
              value={formatCurrency(data.estimatedResult)}
              bold
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-1 text-lg font-bold sm:mt-2 sm:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
