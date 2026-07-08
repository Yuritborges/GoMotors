import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { buildDailyCashReport, cashDateKey, parseCashDateParam } from "@/lib/cash-report";
import {
  cashClosingStorageDate,
  findCashClosingByDateKey,
  normalizeCashDateKey,
} from "@/lib/cash-closing-date";

export async function POST(request: Request) {
  try {
    const user = await requireOwner();
    const body = await request.json().catch(() => ({}));
    const dateParam = body.date as string | undefined;
    const day = parseCashDateParam(dateParam);
    const dateKey = normalizeCashDateKey(dateParam ?? cashDateKey(day));

    const existing = await findCashClosingByDateKey(prisma, dateKey);
    if (existing) {
      return NextResponse.json(
        { error: `O caixa de ${dateKey} já foi fechado.` },
        { status: 400 }
      );
    }

    const report = await buildDailyCashReport(dateKey);

    const closing = await prisma.cashClosing.create({
      data: {
        date: cashClosingStorageDate(dateKey),
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
