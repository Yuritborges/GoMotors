import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleAuthError,
  requireAuth,
  requireOwner,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock-movements";

export async function GET() {
  try {
    await requireAuth();

    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(products);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireOwner();
    const body = await request.json();

    if (!body.name || body.price === undefined) {
      return NextResponse.json(
        { error: "Nome e preço são obrigatórios" },
        { status: 400 }
      );
    }

    const stockVal =
      body.stock !== undefined && body.stock !== "" ? Number(body.stock) : null;

    const product = await prisma.product.create({
      data: {
        name: body.name,
        category: body.category || "GERAL",
        price: Number(body.price),
        stock: stockVal !== null ? 0 : null,
        minStock: Number(body.minStock ?? 5),
        description: body.description || null,
        active: body.active ?? true,
      },
    });

    if (stockVal !== null && stockVal > 0) {
      await recordStockMovement({
        productId: product.id,
        type: "INVENTARIO",
        quantityAfter: stockVal,
        user,
        notes: "Estoque inicial no cadastro",
      });
      product.stock = stockVal;
    }

    await logAudit({
      user,
      action: "PRODUCT_CREATE",
      entityType: "product",
      entityId: product.id,
      summary: `${user.name} cadastrou produto ${product.name}`,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
