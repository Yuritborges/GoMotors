"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  PARTNER_ENTRY_HINTS,
  PARTNER_ENTRY_LABELS,
  isManualLedgerPartner,
} from "@/lib/partner-ledger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { ClientesTabs } from "@/components/clients/clientes-tabs";

type PartnerDetail = {
  id: string;
  name: string;
  active: boolean;
  balance: number;
  periodSummary: {
    washTotal: number;
    orderCount: number;
    dividas: number;
    produtos: number;
    pagamentos: number;
    ledgerDebit: number;
    ledgerCredit: number;
  };
  entries: {
    id: string;
    type: string;
    amount: number;
    description: string;
    installment: string | null;
    date: string;
  }[];
  orders: {
    id: string;
    total: number;
    entryAt: string;
    plate: string;
    model: string | null;
    services: string;
  }[];
};

const emptyForm = {
  type: "DIVIDA" as const,
  amount: "",
  description: "",
  installment: "",
  date: new Date().toISOString().slice(0, 10),
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function LojaParceiraDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [month, setMonth] = useState(currentMonthValue());
  const [data, setData] = useState<PartnerDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [zeroing, setZeroing] = useState(false);

  const load = useCallback(async () => {
    const [y, m] = month.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    const res = await fetch(`/api/partners/${id}?from=${from}&to=${to}`);
    if (res.ok) setData(await res.json());
  }, [id, month]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/partners/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        installment: form.installment || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      return;
    }
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function deleteEntry(entryId: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await fetch(`/api/partners/${id}/entries/${entryId}`, { method: "DELETE" });
    load();
  }

  async function zeroBalance() {
    if (!data) return;
    const msg =
      data.balance > 0
        ? `Registrar pagamento de ${formatCurrency(data.balance)} para zerar o saldo de ${data.name}?`
        : `Registrar ajuste de ${formatCurrency(Math.abs(data.balance))} para zerar o saldo de ${data.name}?`;
    if (!confirm(msg)) return;

    setZeroing(true);
    setError("");
    const res = await fetch(`/api/partners/${id}/zero-balance`, { method: "POST" });
    const json = await res.json();
    setZeroing(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao zerar saldo");
      return;
    }
    load();
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      [`Go Motors — ${data.name}`],
      ["Período", month],
      ["Saldo total a receber", data.balance],
      ["Lavagens no período", data.periodSummary.washTotal],
      [],
      ["Data", "Tipo", "Descrição", "Parcela", "Valor"],
      ...data.entries.map((e) => [
        e.date.slice(0, 10),
        PARTNER_ENTRY_LABELS[e.type as keyof typeof PARTNER_ENTRY_LABELS],
        e.description,
        e.installment ?? "",
        e.amount,
      ]),
      [],
      ["Lavagens"],
      ["Data", "Placa", "Serviços", "Valor"],
      ...data.orders.map((o) => [
        o.entryAt.slice(0, 10),
        o.plate,
        o.services,
        o.total,
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gomotors-${data.name.replace(/\s+/g, "-")}-${month}.csv`;
    a.click();
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={data.name} description="Relatório de gastos, dívidas e lavagens">
        <Link href="/clientes/lojas">
          <Button variant="secondary" className="w-full sm:w-auto">
            Voltar
          </Button>
        </Link>
        <Button variant="outline" className="w-full sm:w-auto" onClick={exportCsv}>
          Exportar CSV
        </Button>
      </PageHeader>

      <ClientesTabs />

      <Field className="max-w-xs">
        <Label>Período</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saldo a receber" value={formatCurrency(data.balance)} highlight="amber" />
        <StatCard label="Lavagens pendentes (mês)" value={formatCurrency(data.periodSummary.washTotal)} />
        <StatCard label="Dívidas/produtos (mês)" value={formatCurrency(data.periodSummary.ledgerDebit)} />
        <StatCard label="Pagamentos (mês)" value={formatCurrency(data.periodSummary.ledgerCredit)} highlight="green" />
      </div>

      {Math.abs(data.balance) >= 0.01 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm text-sky-900">
            Saldo atual: <strong>{formatCurrency(data.balance)}</strong>
            {data.balance < 0 && " (a loja tem crédito — pagou a mais ou lançamentos antigos)"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={zeroing}
            onClick={() => void zeroBalance()}
          >
            {zeroing ? "Zerando..." : "Zerar saldo"}
          </Button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {isManualLedgerPartner(data.name) && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          Dívidas e produtos desta loja são lançados manualmente no sistema (não vêm da planilha).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo lançamento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitEntry} className="space-y-3">
              <Field>
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as typeof form.type,
                    })
                  }
                >
                  {Object.entries(PARTNER_ENTRY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-slate-500">{PARTNER_ENTRY_HINTS[form.type]}</p>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </Field>
              </div>
              <Field>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex.: Extratora 3x500, iPhone, produtos..."
                  required
                />
              </Field>
              <Field>
                <Label>Parcela (opcional)</Label>
                <Input
                  placeholder="Ex.: 2/10"
                  value={form.installment}
                  onChange={(e) => setForm({ ...form, installment: e.target.value })}
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit">Registrar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dívidas e lançamentos ({data.entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-2 overflow-y-auto">
            {data.entries.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum lançamento no período.</p>
            ) : (
              data.entries.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {PARTNER_ENTRY_LABELS[e.type as keyof typeof PARTNER_ENTRY_LABELS]}
                      <span className="ml-2 font-normal text-slate-500">
                        {formatDate(e.date)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700">{e.description}</p>
                    {e.installment && (
                      <p className="text-xs text-slate-500">Parcela: {e.installment}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        e.type === "PAGAMENTO" || e.type === "PARCELA"
                          ? "text-emerald-700"
                          : "text-red-600"
                      )}
                    >
                      {e.type === "PAGAMENTO" || e.type === "PARCELA" ? "−" : "+"}
                      {formatCurrency(e.amount)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => deleteEntry(e.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Lavagens no período ({data.orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.orders.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma lavagem no período.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Data</th>
                  <th className="pb-2 pr-4 font-medium">Placa</th>
                  <th className="pb-2 pr-4 font-medium">Serviço</th>
                  <th className="pb-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{formatDate(o.entryAt)}</td>
                    <td className="py-2 pr-4 font-medium tracking-wide">{o.plate}</td>
                    <td className="py-2 pr-4">{o.services}</td>
                    <td className="py-2 font-semibold tabular-nums">{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="py-2 pr-4">
                    Total lavagens
                  </td>
                  <td className="py-2">{formatCurrency(data.periodSummary.washTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "amber" | "green";
}) {
  return (
    <Card
      className={cn(
        highlight === "amber" && "border-amber-200 bg-amber-50/40",
        highlight === "green" && "border-emerald-200 bg-emerald-50/40"
      )}
    >
      <CardContent className="pt-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
