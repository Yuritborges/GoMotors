import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleAuthError,
  requireAuth,
  requireOwner,
} from "@/lib/auth";

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
    await requireOwner();
    const body = await request.json();

    if (!body.name || body.price === undefined) {
      return NextResponse.json(
        { error: "Nome e preço são obrigatórios" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        category: body.category || "Geral",
        price: Number(body.price),
        stock: body.stock !== undefined && body.stock !== "" ? Number(body.stock) : null,
        minStock: Number(body.minStock ?? 5),
        description: body.description || null,
        active: body.active ?? true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
