import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { cashClosingDisplayKey } from "@/lib/cash-closing-date";

export async function GET() {
  try {
    await requireOwner();

    const closings = await prisma.cashClosing.findMany({
      orderBy: { date: "desc" },
      take: 90,
      select: {
        id: true,
        date: true,
        closedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      closings.map((c) => ({
        id: c.id,
        date: cashClosingDisplayKey(c.date),
        closedBy: c.closedBy,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
