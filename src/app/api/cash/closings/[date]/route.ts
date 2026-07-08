import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { buildDailyCashReport } from "@/lib/cash-report";
import { findCashClosingByDateKey } from "@/lib/cash-closing-date";
import type { DailyCashReport } from "@/lib/cash-report";

type Params = { params: Promise<{ date: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    const dateKey = date;

    const closing = await findCashClosingByDateKey(prisma, dateKey);
    if (closing) {
      return NextResponse.json({
        closed: true,
        closedBy: closing.closedBy,
        createdAt: closing.createdAt.toISOString(),
        report: closing.snapshot as DailyCashReport,
      });
    }

    const report = await buildDailyCashReport(dateKey);
    return NextResponse.json({ closed: false, report });
  } catch (error) {
    return handleAuthError(error);
  }
}
