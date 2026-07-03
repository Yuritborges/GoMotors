import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import type { StockMovementType } from "@/generated/prisma/client";

export async function recordStockMovement(params: {
  productId: string;
  type: StockMovementType;
  quantityAfter: number;
  user?: SessionUser | null;
  unitCost?: number | null;
  notes?: string | null;
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
  });
  if (!product) throw new Error("Produto não encontrado");

  const quantityBefore = product.stock ?? 0;
  const quantityAfter = Math.max(0, params.quantityAfter);
  const delta = quantityAfter - quantityBefore;

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId: params.productId,
        type: params.type,
        quantityBefore,
        quantityAfter,
        delta,
        unitCost: params.unitCost ?? null,
        notes: params.notes ?? null,
        userId: params.user?.id ?? null,
        userName: params.user?.name ?? "Sistema",
      },
    }),
    prisma.product.update({
      where: { id: params.productId },
      data: { stock: quantityAfter },
    }),
  ]);

  return { movement, productName: product.name };
}

export async function applyStockDelta(params: {
  productId: string;
  delta: number;
  type: StockMovementType;
  user?: SessionUser | null;
  unitCost?: number | null;
  notes?: string | null;
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
  });
  if (!product || product.stock === null) {
    throw new Error("Produto sem controle de estoque");
  }

  return recordStockMovement({
    ...params,
    quantityAfter: product.stock + params.delta,
  });
}
