import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireOwner();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
    const entityType = searchParams.get("entityType");

    const logs = await prisma.auditLog.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const productIds = [
      ...new Set(
        logs
          .filter((log) => log.entityType === "product" && log.entityId)
          .map((log) => log.entityId as string)
      ),
    ];

    const products =
      productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [];

    const productNames = new Map(products.map((p) => [p.id, p.name]));

    const enriched = logs.map((log) => {
      let productName: string | null = null;
      if (log.metadata) {
        try {
          const meta = JSON.parse(log.metadata) as { productName?: string };
          productName = meta.productName ?? null;
        } catch {
          /* ignore */
        }
      }
      if (!productName && log.entityType === "product" && log.entityId) {
        productName = productNames.get(log.entityId) ?? null;
      }
      return { ...log, productName };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return handleAuthError(error);
  }
}
