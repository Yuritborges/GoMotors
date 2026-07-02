"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { ClientesTabs } from "@/components/clients/clientes-tabs";

type Partner = {
  id: string;
  name: string;
  active: boolean;
  orderCount: number;
  washTotal: number;
  balance: number;
  entryCount: number;
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function LojasParceirasPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const [y, m] = month.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    const res = await fetch(`/api/partners?from=${from}&to=${to}`);
    setPartners(await res.json());
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setName("");
    setShowForm(false);
    load();
  }

  const totalBalance = partners.reduce((s, p) => s + p.balance, 0);
  const totalWash = partners.reduce((s, p) => s + p.washTotal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lojas parceiras"
        description="Controle de lavagens, dívidas e pagamentos — como na planilha LOJAS"
      >
        <Button className="w-full sm:w-auto" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "+ Nova loja"}
        </Button>
      </PageHeader>

      <ClientesTabs />

      <Field className="max-w-xs">
        <Label>Período</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Lavagens no mês</p>
            <p className="text-xl font-bold">{formatCurrency(totalWash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Saldo total a receber</p>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Lojas cadastradas</p>
            <p className="text-xl font-bold">{partners.length}</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={createPartner} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field className="flex-1">
                <Label>Nome da loja</Label>
                <Input
                  placeholder="Ex.: MAGRÃO, NOBEL..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit">Cadastrar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {partners.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Nenhuma loja parceira. Cadastre manualmente ou rode{" "}
            <code className="rounded bg-slate-100 px-1">npm run db:import</code> com a planilha LOJAS.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <Link key={p.id} href={`/clientes/lojas/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    {!p.active && (
                      <Badge className="border-slate-200 bg-slate-100 text-slate-500">Inativa</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {p.orderCount} lavagens · {p.entryCount} lançamentos no mês
                  </p>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Mês</p>
                      <p className="font-semibold">{formatCurrency(p.washTotal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Saldo total</p>
                      <p
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          p.balance > 0 ? "text-amber-700" : "text-emerald-700"
                        )}
                      >
                        {formatCurrency(p.balance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
