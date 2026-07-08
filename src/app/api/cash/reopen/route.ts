import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { cashDateKey, parseCashDateParam } from "@/lib/cash-report";
import { startOfDay } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json().catch(() => ({}));
    const dateParam = body.date as string | undefined;
    const day = parseCashDateParam(dateParam);
    const dateKey = cashDateKey(day);
    const dayStart = startOfDay(day);

    const existing = await prisma.cashClosing.findUnique({ where: { date: dayStart } });
    if (!existing) {
      return NextResponse.json(
        { error: `O caixa de ${dateKey} não está fechado.` },
        { status: 400 }
      );
    }

    await prisma.cashClosing.delete({ where: { date: dayStart } });

    return NextResponse.json({
      date: dateKey,
      reopened: true,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
