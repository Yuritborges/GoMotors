import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";
import { handleAuthError, requireAuth } from "@/lib/auth";

export async function POST() {
  try {
    await requireAuth();

    const readyOrders = await prisma.serviceOrder.findMany({
      where: {
        status: "PRONTO",
        paymentStatus: "PAGO",
        entryAt: { gte: startOfDay(), lte: endOfDay() },
      },
    });

    if (readyOrders.length === 0) {
      return NextResponse.json({
        delivered: 0,
        skippedPending: await prisma.serviceOrder.count({
          where: {
            status: "PRONTO",
            paymentStatus: "PENDENTE",
            entryAt: { gte: startOfDay(), lte: endOfDay() },
          },
        }),
      });
    }

    await prisma.serviceOrder.updateMany({
      where: { id: { in: readyOrders.map((o) => o.id) } },
      data: { status: "ENTREGUE", deliveredAt: new Date() },
    });

    const skippedPending = await prisma.serviceOrder.count({
      where: {
        status: "PRONTO",
        paymentStatus: "PENDENTE",
        entryAt: { gte: startOfDay(), lte: endOfDay() },
      },
    });

    return NextResponse.json({
      delivered: readyOrders.length,
      skippedPending,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
