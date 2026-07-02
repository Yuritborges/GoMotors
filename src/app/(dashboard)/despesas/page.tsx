"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceKpiCard } from "@/components/finance/finance-charts";

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DespesasPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [month, setMonth] = useState(currentMonthValue());
  const [finance, setFinance] = useState<{
    expenses: number;
    revenue: number;
    profit: number;
  } | null>(null);
  const [form, setForm] = useState({
    category: "PRODUTOS_LIMPEZA",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const autoMonth = useRef(false);

  const loadExpenses = useCallback(async () => {
    const [y, m] = month.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    const [expRes, finRes] = await Promise.all([
      fetch(`/api/expenses?from=${from}&to=${to}`),
      fetch(`/api/finance?month=${month}`),
    ]);
    const fin = await finRes.json();

    if (
      !autoMonth.current &&
      fin.suggestedMonth &&
      fin.suggestedMonth !== month &&
      fin.revenue === 0 &&
      fin.expenses === 0
    ) {
      autoMonth.current = true;
      setMonth(fin.suggestedMonth);
      return;
    }

    setExpenses(await expRes.json());
    setFinance({
      expenses: fin.expenses,
      revenue: fin.revenue,
      profit: fin.profit,
    });
  }, [month]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });
    setForm({
      category: "PRODUTOS_LIMPEZA",
      description: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
    });
    loadExpenses();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Despesas" description="Controle de gastos do Go Motors">
        <Link href="/financeiro">
          <Button variant="secondary" className="w-full sm:w-auto">
            Ver financeiro
          </Button>
        </Link>
      </PageHeader>

      <Field className="max-w-xs">
        <Label>Mês</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>

      {finance && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <FinanceKpiCard title="Despesas do mês" value={formatCurrency(finance.expenses)} variant="expense" />
          <FinanceKpiCard title="Receita do mês" value={formatCurrency(finance.revenue)} variant="revenue" />
          <FinanceKpiCard title="Lucro do mês" value={formatCurrency(finance.profit)} variant="profit" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Nova despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field>
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  required
                />
              </Field>
              <Field>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
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
              <Button type="submit" className="w-full">
                Registrar despesa
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Lançamentos do mês · Total listado: {formatCurrency(total)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma despesa registrada.</p>
            ) : (
              expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{expense.description}</p>
                    <p className="text-xs text-slate-500">
                      {EXPENSE_CATEGORY_LABELS[expense.category]} ·{" "}
                      {formatDate(expense.date)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
