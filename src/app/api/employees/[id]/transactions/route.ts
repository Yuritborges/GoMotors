import { NextResponse } from "next/server";
import type { EmployeeTransactionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const VALID_TYPES: EmployeeTransactionType[] = ["VALE", "REEMBOLSO", "DESCONTO"];

export async function POST(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id: employeeId } = await params;
    const body = await request.json();

    const type = String(body.type ?? "").toUpperCase() as EmployeeTransactionType;
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });
    }

    const transaction = await prisma.employeeTransaction.create({
      data: {
        employeeId,
        type,
        amount,
        description: body.description ? String(body.description).trim().slice(0, 200) : null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
