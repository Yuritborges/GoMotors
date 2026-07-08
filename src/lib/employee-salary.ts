import type { EmployeeTransactionType } from "@/generated/prisma/client";

type Tx = {
  type: EmployeeTransactionType;
  amount: number;
  date: Date;
};

/**
 * Quanto ainda falta pagar ao funcionário no ciclo atual.
 * Vales/descontos abatem; pagamento de salário zera (quitado).
 * Lançamentos após o pagamento iniciam um novo ciclo a partir do salário base.
 */
export function computeSalaryRemaining(baseSalary: number, transactions: Tx[]): number {
  if (baseSalary <= 0) return 0;

  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  let remaining = baseSalary;

  for (const t of sorted) {
    switch (t.type) {
      case "PAGAMENTO_SALARIO":
        remaining = 0;
        break;
      case "VALE":
      case "DESCONTO":
        if (remaining <= 0) remaining = baseSalary;
        remaining -= t.amount;
        break;
      case "REEMBOLSO":
        if (remaining <= 0) remaining = baseSalary;
        remaining += t.amount;
        break;
    }
  }

  return Math.max(0, remaining);
}

/** Valor já abatido do salário no ciclo atual (desde último pagamento). */
export function computeSalaryDeducted(baseSalary: number, transactions: Tx[]): number {
  const remaining = computeSalaryRemaining(baseSalary, transactions);
  return Math.max(0, baseSalary - remaining);
}

/** Lançamentos desde o último pagamento de salário (ciclo em aberto). */
export function transactionsInCurrentCycle(transactions: Tx[]): Tx[] {
  const sorted = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
  const cycle: Tx[] = [];
  for (const t of sorted) {
    if (t.type === "PAGAMENTO_SALARIO") break;
    cycle.push(t);
  }
  return cycle.reverse();
}
