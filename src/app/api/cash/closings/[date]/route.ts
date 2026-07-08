import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { buildDailyCashReport } from "@/lib/cash-report";
import { startOfDay } from "@/lib/utils";
import type { DailyCashReport } from "@/lib/cash-report";

type Params = { params: Promise<{ date: string }> };

function parseDateParam(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return startOfDay(new Date(`${date}T12:00:00`));
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { date } = await params;
    const dayStart = parseDateParam(date);
    if (!dayStart) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }

    const closing = await prisma.cashClosing.findUnique({ where: { date: dayStart } });
    if (closing) {
      return NextResponse.json({
        closed: true,
        closedBy: closing.closedBy,
        createdAt: closing.createdAt.toISOString(),
        report: closing.snapshot as DailyCashReport,
      });
    }

    const report = await buildDailyCashReport(date);
    return NextResponse.json({ closed: false, report });
  } catch (error) {
    return handleAuthError(error);
  }
}
