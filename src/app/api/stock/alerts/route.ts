import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

export async function GET() {
  try {
    await requireOwner();

    const products = await prisma.product.findMany({
      where: { active: true, stock: { not: null } },
      orderBy: { stock: "asc" },
    });

    const lowStock = products.filter(
      (p) => p.stock !== null && p.stock <= p.minStock
    );

    return NextResponse.json({
      lowStock,
      count: lowStock.length,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
