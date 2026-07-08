"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  EMPLOYEE_TRANSACTION_HINTS,
  EMPLOYEE_TRANSACTION_LABELS,
} from "@/lib/employee-ledger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

type Transaction = {
  id: string;
  type: "VALE" | "REEMBOLSO" | "DESCONTO" | "PAGAMENTO_SALARIO";
  amount: number;
  description: string | null;
  date: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  salary: number;
  active: boolean;
  orderCount: number;
  salaryRemaining: number;
  salaryDeducted: number;
  cycleSummary: {
    vales: number;
    reembolsos: number;
    descontos: number;
    pagamentosSalario: number;
    netExpense: number;
  };
  cycleTransactions: Transaction[];
  periodSummary: {
    vales: number;
    reembolsos: number;
    descontos: number;
    pagamentosSalario: number;
    netExpense: number;
  };
  transactions: Transaction[];
  allTransactions: Transaction[];
};

const emptyTxForm: {
  type: "VALE" | "REEMBOLSO" | "DESCONTO" | "PAGAMENTO_SALARIO";
  amount: string;
  description: string;
  date: string;
} = {
  type: "VALE",
  amount: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
};

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function salaryStatus(remaining: number, base: number) {
  if (base <= 0) return { text: "Sem salário", className: "border-slate-200 bg-slate-50 text-slate-600" };
  if (remaining >= base) return { text: "Integral", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (remaining > 0) return { text: "Parcial", className: "border-amber-200 bg-amber-50 text-amber-800" };
  return { text: "Quitado", className: "border-sky-200 bg-sky-50 text-sky-800" };
}

export default function FuncionariosPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeSalary, setEmployeeSalary] = useState("");
  const [txForm, setTxForm] = useState(emptyTxForm);
  const [error, setError] = useState("");

  const selected = employees.find((e) => e.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const [y, m] = month.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;

    const res = await fetch(`/api/employees?manage=true&from=${from}&to=${to}`);
    const data: EmployeeRow[] = await res.json();
    setEmployees(data);
    setSelectedId((prev) => {
      if (prev && data.some((e) => e.id === prev)) return prev;
      return data[0]?.id ?? null;
    });
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateEmployee() {
    setEditingEmployee(null);
    setEmployeeName("");
    setEmployeeSalary("");
    setShowEmployeeForm(true);
    setError("");
  }

  function openEditEmployee(emp: EmployeeRow) {
    setEditingEmployee(emp);
    setEmployeeName(emp.name);
    setEmployeeSalary(emp.salary > 0 ? String(emp.salary) : "");
    setShowEmployeeForm(true);
    setError("");
  }

  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = employeeName.trim();
    if (!name) return;
    const salary = employeeSalary ? Number(employeeSalary) : 0;

    const res = editingEmployee
      ? await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, salary }),
        })
      : await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, salary }),
        });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar");
      return;
    }

    setShowEmployeeForm(false);
    setEditingEmployee(null);
    setEmployeeName("");
    setEmployeeSalary("");
    load();
    if (!editingEmployee) setSelectedId(data.id);
  }

  async function toggleActive(emp: EmployeeRow) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
    load();
  }

  async function deleteEmployee(emp: EmployeeRow) {
    if (!confirm(`Excluir ${emp.name}? Lançamentos financeiros também serão removidos.`)) return;
    const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Erro ao excluir");
      return;
    }
    load();
  }

  async function submitTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");

    const payload =
      txForm.type === "PAGAMENTO_SALARIO"
        ? { type: txForm.type, description: txForm.description, date: txForm.date }
        : { ...txForm, amount: Number(txForm.amount) };

    const res = await fetch(`/api/employees/${selected.id}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar lançamento");
      return;
    }

    setTxForm({ ...emptyTxForm, date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function deleteTransaction(txId: string) {
    if (!selected || !confirm("Excluir este lançamento?")) return;
    await fetch(`/api/employees/${selected.id}/transactions/${txId}`, {
      method: "DELETE",
    });
    load();
  }

  async function closeAllCycles() {
    const open = employees.filter((e) => e.salaryRemaining > 0);
    if (open.length === 0) return;
    if (
      !confirm(
        `Quitar salário de ${open.length} funcionário(s)? Os vales antigos permanecem no histórico, mas deixam de abater o salário.`
      )
    ) {
      return;
    }
    setError("");
    const res = await fetch("/api/employees/close-cycles", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao fechar ciclos");
      return;
    }
    load();
  }

  async function closeSelectedSalary() {
    if (!selected || selected.salaryRemaining <= 0) return;
    if (
      !confirm(
        `Registrar pagamento de ${formatCurrency(selected.salaryRemaining)} para ${selected.name}? O histórico de vales será mantido.`
      )
    ) {
      return;
    }
    setError("");
    const res = await fetch(`/api/employees/${selected.id}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PAGAMENTO_SALARIO",
        description: "Fechamento de ciclo — quitado",
        date: new Date().toISOString().slice(0, 10),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar pagamento");
      return;
    }
    load();
  }

  const anySalaryOpen = employees.some((e) => e.salaryRemaining > 0);

  const periodTotals = employees.reduce(
    (acc, e) => ({
      vales: acc.vales + e.periodSummary.vales,
      reembolsos: acc.reembolsos + e.periodSummary.reembolsos,
      descontos: acc.descontos + e.periodSummary.descontos,
      net: acc.net + e.periodSummary.netExpense,
    }),
    { vales: 0, reembolsos: 0, descontos: 0, net: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funcionários"
        description="Equipe, salários, vales, descontos e pagamentos"
      >
        <Link href="/relatorios">
          <Button variant="secondary" className="w-full sm:w-auto">
            Ver auditoria
          </Button>
        </Link>
        <Button className="w-full sm:w-auto" onClick={openCreateEmployee}>
          Novo funcionário
        </Button>
        {anySalaryOpen && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={closeAllCycles}>
            Quitar todos (fechar ciclo)
          </Button>
        )}
      </PageHeader>

      <Field className="max-w-xs">
        <Label>Período dos lançamentos (filtro do DRE)</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi title="Vales no mês" value={formatCurrency(periodTotals.vales)} variant="expense" />
        <MiniKpi title="Reembolsos" value={formatCurrency(periodTotals.reembolsos)} variant="expense" />
        <MiniKpi title="Descontos" value={formatCurrency(periodTotals.descontos)} variant="credit" />
        <MiniKpi title="Impacto no DRE" value={formatCurrency(periodTotals.net)} variant="neutral" />
      </div>

      {showEmployeeForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingEmployee ? "Editar funcionário" : "Novo funcionário"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveEmployee} className="grid gap-3 sm:grid-cols-2">
              <Field>
                <Label>Nome</Label>
                <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required />
              </Field>
              <Field>
                <Label>Salário mensal (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={employeeSalary}
                  onChange={(e) => setEmployeeSalary(e.target.value)}
                  placeholder="2200.00"
                />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">{editingEmployee ? "Salvar" : "Criar"}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowEmployeeForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Equipe ({employees.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employees.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum funcionário cadastrado.</p>
            ) : (
              employees.map((emp) => {
                const status = salaryStatus(emp.salaryRemaining, emp.salary);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedId(emp.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      selectedId === emp.id
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{emp.name}</p>
                        <p className="text-xs text-slate-500">
                          Salário {formatCurrency(emp.salary || 0)}
                        </p>
                      </div>
                      {!emp.active && (
                        <Badge className="border-slate-200 bg-slate-100 text-slate-500">Inativo</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge className={status.className}>{status.text}</Badge>
                      <span className="text-sm font-bold tabular-nums text-slate-800">
                        {formatCurrency(emp.salaryRemaining)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {selected ? (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>{selected.name}</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Salário base:{" "}
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(selected.salary)}
                      </span>
                      {" · "}
                      Restante a pagar:{" "}
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(selected.salaryRemaining)}
                      </span>
                    </p>
                    {selected.salaryDeducted > 0 && (
                      <p className="mt-1 text-xs text-amber-800">
                        Abatido no ciclo atual (desde o último pagamento de salário):{" "}
                        <strong>{formatCurrency(selected.salaryDeducted)}</strong>
                        {selected.cycleSummary.vales > 0 &&
                          ` · Vales ${formatCurrency(selected.cycleSummary.vales)}`}
                        {selected.cycleSummary.descontos > 0 &&
                          ` · Descontos ${formatCurrency(selected.cycleSummary.descontos)}`}
                        {selected.cycleSummary.reembolsos > 0 &&
                          ` · Reembolsos +${formatCurrency(selected.cycleSummary.reembolsos)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.salaryRemaining > 0 && (
                      <Button size="sm" onClick={closeSelectedSalary}>
                        Quitar salário ({formatCurrency(selected.salaryRemaining)})
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEditEmployee(selected)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(selected)}>
                      {selected.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteEmployee(selected)}>
                      Excluir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                    <div className="rounded-lg bg-red-50 px-2 py-2">
                      <p className="text-xs text-red-600">Vales (mês)</p>
                      <p className="font-semibold">{formatCurrency(selected.periodSummary.vales)}</p>
                    </div>
                    <div className="rounded-lg bg-orange-50 px-2 py-2">
                      <p className="text-xs text-orange-600">Reembolsos (mês)</p>
                      <p className="font-semibold">{formatCurrency(selected.periodSummary.reembolsos)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-2 py-2">
                      <p className="text-xs text-emerald-600">Descontos (mês)</p>
                      <p className="font-semibold">{formatCurrency(selected.periodSummary.descontos)}</p>
                    </div>
                    <div className="rounded-lg bg-sky-50 px-2 py-2">
                      <p className="text-xs text-sky-600">Pagamentos (mês)</p>
                      <p className="font-semibold">
                        {formatCurrency(selected.periodSummary.pagamentosSalario ?? 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Novo lançamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitTransaction} className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <Label>Tipo</Label>
                      <Select
                        value={txForm.type}
                        onChange={(e) =>
                          setTxForm({
                            ...txForm,
                            type: e.target.value as
                              | "VALE"
                              | "REEMBOLSO"
                              | "DESCONTO"
                              | "PAGAMENTO_SALARIO",
                          })
                        }
                      >
                        {Object.entries(EMPLOYEE_TRANSACTION_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                      <p className="mt-1 text-xs text-slate-500">
                        {EMPLOYEE_TRANSACTION_HINTS[txForm.type]}
                      </p>
                    </Field>
                    {txForm.type !== "PAGAMENTO_SALARIO" ? (
                      <Field>
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={txForm.amount}
                          onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                          required
                        />
                      </Field>
                    ) : (
                      <Field>
                        <Label>Valor a pagar</Label>
                        <Input
                          readOnly
                          value={formatCurrency(selected.salaryRemaining)}
                          className="bg-slate-50"
                        />
                      </Field>
                    )}
                    <Field>
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={txForm.date}
                        onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                        required
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <Label>Descrição (opcional)</Label>
                      <Textarea
                        value={txForm.description}
                        onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                        rows={2}
                      />
                    </Field>
                    {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
                    <div className="sm:col-span-2">
                      <Button type="submit">
                        {txForm.type === "PAGAMENTO_SALARIO"
                          ? "Registrar pagamento de salário"
                          : "Registrar lançamento"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {selected.cycleTransactions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Ciclo atual — abate o salário ({selected.cycleTransactions.length})
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Lançamentos desde o último pagamento de salário (podem ser de meses anteriores)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selected.cycleTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50/80 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {EMPLOYEE_TRANSACTION_LABELS[tx.type]}
                            <span className="ml-2 text-slate-500">{formatDate(tx.date)}</span>
                          </p>
                          {tx.description && (
                            <p className="text-xs text-slate-500">{tx.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              tx.type === "DESCONTO" || tx.type === "PAGAMENTO_SALARIO"
                                ? "text-emerald-700"
                                : "text-red-600"
                            )}
                          >
                            {tx.type === "DESCONTO" || tx.type === "PAGAMENTO_SALARIO" ? "−" : "+"}
                            {formatCurrency(tx.amount)}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => deleteTransaction(tx.id)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Lançamentos do período ({selected.transactions.length})
                  </CardTitle>
                  <p className="text-xs text-slate-500">Filtro do mês selecionado acima (relatório DRE)</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selected.transactions.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum lançamento neste mês.</p>
                  ) : (
                    selected.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {EMPLOYEE_TRANSACTION_LABELS[tx.type]}
                            <span className="ml-2 text-slate-500">{formatDate(tx.date)}</span>
                          </p>
                          {tx.description && (
                            <p className="text-xs text-slate-500">{tx.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              tx.type === "DESCONTO" || tx.type === "PAGAMENTO_SALARIO"
                                ? "text-emerald-700"
                                : "text-red-600"
                            )}
                          >
                            {tx.type === "DESCONTO" || tx.type === "PAGAMENTO_SALARIO" ? "−" : "+"}
                            {formatCurrency(tx.amount)}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => deleteTransaction(tx.id)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Histórico completo ({selected.allTransactions.length})
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Todos os lançamentos — vales antigos ficam aqui após quitar o salário
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selected.allTransactions.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum lançamento registrado.</p>
                  ) : (
                    selected.allTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {EMPLOYEE_TRANSACTION_LABELS[tx.type]}
                            <span className="ml-2 text-slate-500">{formatDate(tx.date)}</span>
                          </p>
                          {tx.description && (
                            <p className="text-xs text-slate-500">{tx.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              tx.type === "DESCONTO" || tx.type === "PAGAMENTO_SALARIO"
                                ? "text-emerald-700"
                                : "text-red-600"
                            )}
                          >
                            {tx.type === "DESCONTO" || tx.type === "PAGAMENTO_SALARIO" ? "−" : "+"}
                            {formatCurrency(tx.amount)}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => deleteTransaction(tx.id)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-slate-500">
                Selecione um funcionário ou cadastre um novo.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniKpi({
  title,
  value,
  variant,
}: {
  title: string;
  value: string;
  variant: "expense" | "credit" | "neutral";
}) {
  const styles = {
    expense: "border-red-200 bg-red-50/50",
    credit: "border-emerald-200 bg-emerald-50/50",
    neutral: "border-sky-200 bg-sky-50/50",
  };
  return (
    <Card className={styles[variant]}>
      <CardContent className="pt-4">
        <p className="text-xs text-slate-500">{title}</p>
        <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
