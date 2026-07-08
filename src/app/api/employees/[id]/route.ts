import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const body = await request.json();

    const data: { name?: string; active?: boolean; salary?: number } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.salary !== undefined) {
      const salary = Number(body.salary);
      if (!Number.isFinite(salary) || salary < 0) {
        return NextResponse.json({ error: "Salário inválido" }, { status: 400 });
      }
      data.salary = salary;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });

    return NextResponse.json(employee);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;

    const orderCount = await prisma.serviceOrder.count({ where: { employeeId: id } });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          error: `Este funcionário tem ${orderCount} ordem(ns) vinculada(s). Desative em vez de excluir.`,
        },
        { status: 400 }
      );
    }

    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
