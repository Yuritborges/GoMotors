import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";
import { recordStockMovement } from "@/lib/stock-movements";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireOwner();
    const { id } = await params;
    const body = await request.json();

    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const newStock =
      body.stock !== undefined && body.stock !== ""
        ? Number(body.stock)
        : null;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        category: body.category,
        price: Number(body.price),
        stock:
          before.stock !== null &&
          newStock !== null &&
          newStock !== before.stock
            ? before.stock
            : newStock,
        minStock: Number(body.minStock ?? 5),
        description: body.description ?? null,
        active: body.active,
      },
    });

    if (
      before.stock !== null &&
      newStock !== null &&
      newStock !== before.stock
    ) {
      await recordStockMovement({
        productId: id,
        type: "INVENTARIO",
        quantityAfter: newStock,
        user,
        notes: "Ajuste via edição do produto",
      });
      product.stock = newStock;
    }

    return NextResponse.json(product);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;

    await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
