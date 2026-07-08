import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { closeAllEmployeeSalaryCycles } from "@/lib/employee-cycle-close";

/** Fecha o ciclo de salário de todos os funcionários ativos, preservando o histórico. */
export async function POST() {
  try {
    await requireOwner();
    const results = await closeAllEmployeeSalaryCycles(prisma);
    const paid = results.filter((r) => r.status === "paid");

    return NextResponse.json({
      message:
        paid.length > 0
          ? `${paid.length} funcionário(s) quitado(s). Histórico preservado.`
          : "Todos os funcionários já estavam quitados.",
      results,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
