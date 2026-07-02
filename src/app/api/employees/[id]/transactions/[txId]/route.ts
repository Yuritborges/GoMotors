import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string; txId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id: employeeId, txId } = await params;

    const tx = await prisma.employeeTransaction.findFirst({
      where: { id: txId, employeeId },
    });
    if (!tx) {
      return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });
    }

    await prisma.employeeTransaction.delete({ where: { id: txId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
