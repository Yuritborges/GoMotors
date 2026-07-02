import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth, requireOwner } from "@/lib/auth";
import { computeBalance, summarizeByType } from "@/lib/employee-ledger";
import { endOfDay, startOfDay } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const manage = searchParams.get("manage") === "true";

    if (manage) {
      await requireOwner();
      const fromParam = searchParams.get("from");
      const toParam = searchParams.get("to");
      const from = fromParam ? startOfDay(new Date(fromParam)) : null;
      const to = toParam ? endOfDay(new Date(toParam)) : null;

      const employees = await prisma.employee.findMany({
        orderBy: { name: "asc" },
        include: {
          transactions: { orderBy: { date: "desc" } },
          _count: { select: { orders: true } },
        },
      });

      return NextResponse.json(
        employees.map((e) => {
          const periodTx =
            from && to
              ? e.transactions.filter((t) => t.date >= from && t.date <= to)
              : e.transactions;

          return {
            id: e.id,
            name: e.name,
            active: e.active,
            createdAt: e.createdAt,
            orderCount: e._count.orders,
            balance: computeBalance(e.transactions),
            periodSummary: summarizeByType(periodTx),
            transactions: periodTx.map((t) => ({
              id: t.id,
              type: t.type,
              amount: t.amount,
              description: t.description,
              date: t.date.toISOString(),
            })),
          };
        })
      );
    }

    const employees = await prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: { name, active: body.active !== false },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
