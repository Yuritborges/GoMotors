import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { buildDailyCashReport, cashDateKey, parseCashDateParam } from "@/lib/cash-report";
import { startOfDay } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const user = await requireOwner();
    const body = await request.json().catch(() => ({}));
    const dateParam = body.date as string | undefined;
    const day = parseCashDateParam(dateParam);
    const dateKey = cashDateKey(day);
    const dayStart = startOfDay(day);

    const existing = await prisma.cashClosing.findUnique({ where: { date: dayStart } });
    if (existing) {
      return NextResponse.json(
        { error: `O caixa de ${dateKey} já foi fechado.` },
        { status: 400 }
      );
    }

    const report = await buildDailyCashReport(dateKey);

    const closing = await prisma.cashClosing.create({
      data: {
        date: dayStart,
        closedBy: user.name,
        snapshot: report as object,
      },
    });

    return NextResponse.json({
      id: closing.id,
      date: dateKey,
      closedBy: closing.closedBy,
      createdAt: closing.createdAt.toISOString(),
      report,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
