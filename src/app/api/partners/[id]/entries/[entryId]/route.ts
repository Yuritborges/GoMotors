import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireOwner } from "@/lib/auth";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id: partnerStoreId, entryId } = await params;

    const entry = await prisma.partnerLedgerEntry.findFirst({
      where: { id: entryId, partnerStoreId },
    });
    if (!entry) {
      return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });
    }

    await prisma.partnerLedgerEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
