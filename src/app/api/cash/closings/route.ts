import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

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
        date: c.date.toISOString().slice(0, 10),
        closedBy: c.closedBy,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
