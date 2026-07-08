import type { EmployeeTransactionType } from "@/generated/prisma/client";

export const EMPLOYEE_TRANSACTION_LABELS: Record<EmployeeTransactionType, string> = {
  VALE: "Vale",
  REEMBOLSO: "Reembolso",
  DESCONTO: "Desconto",
  PAGAMENTO_SALARIO: "Pagamento de salário",
};

export const EMPLOYEE_TRANSACTION_HINTS: Record<EmployeeTransactionType, string> = {
  VALE: "Adiantamento — abate do salário do funcionário",
  REEMBOLSO: "Reembolso de despesa — aumenta o salário restante",
  DESCONTO: "Desconto — abate do salário do funcionário",
  PAGAMENTO_SALARIO: "Registra o pagamento do valor devido e zera o restante a pagar",
};

type Tx = { type: EmployeeTransactionType; amount: number };

/** @deprecated Use computeSalaryRemaining para exibição de salário */
export function balanceDelta(type: EmployeeTransactionType, amount: number): number {
  switch (type) {
    case "REEMBOLSO":
      return amount;
    case "VALE":
    case "DESCONTO":
      return -amount;
    case "PAGAMENTO_SALARIO":
      return 0;
  }
}

/** @deprecated Use computeSalaryRemaining */
export function computeBalance(transactions: Tx[]): number {
  return transactions.reduce((sum, t) => sum + balanceDelta(t.type, t.amount), 0);
}

/** Impacto no DRE do período */
export function expenseImpact(type: EmployeeTransactionType, amount: number): number {
  switch (type) {
    case "VALE":
    case "REEMBOLSO":
    case "PAGAMENTO_SALARIO":
      return amount;
    case "DESCONTO":
      return -amount;
  }
}

export function computePeriodEmployeeExpense(transactions: Tx[]): number {
  return transactions.reduce((sum, t) => sum + expenseImpact(t.type, t.amount), 0);
}

export function summarizeByType(transactions: Tx[]) {
  const totals = { VALE: 0, REEMBOLSO: 0, DESCONTO: 0, PAGAMENTO_SALARIO: 0 };
  for (const t of transactions) {
    totals[t.type] += t.amount;
  }
  return {
    vales: totals.VALE,
    reembolsos: totals.REEMBOLSO,
    descontos: totals.DESCONTO,
    pagamentosSalario: totals.PAGAMENTO_SALARIO,
    netExpense: computePeriodEmployeeExpense(transactions),
  };
}
