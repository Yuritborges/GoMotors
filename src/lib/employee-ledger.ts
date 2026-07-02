import type { EmployeeTransactionType } from "@/generated/prisma/client";

export const EMPLOYEE_TRANSACTION_LABELS: Record<EmployeeTransactionType, string> = {
  VALE: "Vale",
  REEMBOLSO: "Reembolso",
  DESCONTO: "Desconto",
};

export const EMPLOYEE_TRANSACTION_HINTS: Record<EmployeeTransactionType, string> = {
  VALE: "Adiantamento — reduz o saldo (funcionário deve à empresa)",
  REEMBOLSO: "Reembolso de despesa — aumenta o saldo (empresa deve ao funcionário)",
  DESCONTO: "Desconto aplicado — reduz o saldo a favor da empresa",
};

type Tx = { type: EmployeeTransactionType; amount: number };

/** Saldo acumulado: positivo = empresa deve; negativo = funcionário deve */
export function balanceDelta(type: EmployeeTransactionType, amount: number): number {
  switch (type) {
    case "REEMBOLSO":
      return amount;
    case "VALE":
    case "DESCONTO":
      return -amount;
  }
}

export function computeBalance(transactions: Tx[]): number {
  return transactions.reduce((sum, t) => sum + balanceDelta(t.type, t.amount), 0);
}

/** Impacto no DRE do período (vales e reembolsos = despesa; desconto = redução) */
export function expenseImpact(type: EmployeeTransactionType, amount: number): number {
  switch (type) {
    case "VALE":
    case "REEMBOLSO":
      return amount;
    case "DESCONTO":
      return -amount;
  }
}

export function computePeriodEmployeeExpense(transactions: Tx[]): number {
  return transactions.reduce((sum, t) => sum + expenseImpact(t.type, t.amount), 0);
}

export function summarizeByType(transactions: Tx[]) {
  const totals = { VALE: 0, REEMBOLSO: 0, DESCONTO: 0 };
  for (const t of transactions) {
    totals[t.type] += t.amount;
  }
  return {
    vales: totals.VALE,
    reembolsos: totals.REEMBOLSO,
    descontos: totals.DESCONTO,
    netExpense: computePeriodEmployeeExpense(transactions),
  };
}
