import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import {
  findCashClosingByDateKey,
  normalizeCashDateKey,
} from "@/lib/cash-closing-date";

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json().catch(() => ({}));
    const dateParam = body.date as string | undefined;
    const dateKey = normalizeCashDateKey(dateParam);

    const existing = await findCashClosingByDateKey(prisma, dateKey);
    if (!existing) {
      return NextResponse.json(
        { error: `O caixa de ${dateKey} não está fechado.` },
        { status: 400 }
      );
    }

    await prisma.cashClosing.delete({ where: { id: existing.id } });

    return NextResponse.json({
      date: dateKey,
      reopened: true,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
