import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const body = await request.json();

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        category: body.category,
        price: Number(body.price),
        stock:
          body.stock !== undefined && body.stock !== ""
            ? Number(body.stock)
            : null,
        minStock: Number(body.minStock ?? 5),
        description: body.description ?? null,
        active: body.active,
      },
    });

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
