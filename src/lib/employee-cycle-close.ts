import type { EmployeeTransactionType } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { computeSalaryRemaining } from "@/lib/employee-salary";
import { businessDateKey, parseBusinessDateInput } from "@/lib/business-day";

export const CYCLE_CLOSE_DESCRIPTION = "Fechamento de ciclo — quitado";

type Tx = {
  type: EmployeeTransactionType;
  amount: number;
  date: Date;
};

export type CloseCycleResult =
  | { name: string; status: "paid"; amount: number; historyCount: number }
  | { name: string; status: "skipped"; reason: string; historyCount: number };

export async function closeEmployeeSalaryCycle(
  prisma: PrismaClient,
  employee: { id: string; name: string; salary: number; transactions: Tx[] },
  paidAt = new Date()
): Promise<CloseCycleResult> {
  const historyCount = employee.transactions.length;
  const paidDate = parseBusinessDateInput(businessDateKey(paidAt));

  if (employee.salary <= 0) {
    return { name: employee.name, status: "skipped", reason: "sem salário base", historyCount };
  }

  const remaining = computeSalaryRemaining(employee.salary, employee.transactions);
  if (remaining <= 0) {
    return { name: employee.name, status: "skipped", reason: "já quitado", historyCount };
  }

  await prisma.employeeTransaction.create({
    data: {
      employeeId: employee.id,
      type: "PAGAMENTO_SALARIO",
      amount: remaining,
      date: paidDate,
      description: CYCLE_CLOSE_DESCRIPTION,
    },
  });

  return { name: employee.name, status: "paid", amount: remaining, historyCount };
}

export async function closeAllEmployeeSalaryCycles(prisma: PrismaClient, paidAt = new Date()) {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: { transactions: { orderBy: { date: "asc" } } },
    orderBy: { name: "asc" },
  });

  const results: CloseCycleResult[] = [];
  for (const employee of employees) {
    results.push(await closeEmployeeSalaryCycle(prisma, employee, paidAt));
  }
  return results;
}
