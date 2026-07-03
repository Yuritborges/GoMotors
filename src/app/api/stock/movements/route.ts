import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const movements = await prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(movements);
  } catch (error) {
    return handleAuthError(error);
  }
}
