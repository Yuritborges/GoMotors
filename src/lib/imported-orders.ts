import type { Prisma } from "../generated/prisma/client";

/** Ordens criadas pelo import das planilhas (histórico), não pela operação diária. */
export function isImportedHistoricalOrder(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return (
    notes.includes("ROTATIVO/") ||
    notes.includes("LOJAS/") ||
    notes.includes("Loja parceira:")
  );
}

/** Filtro Prisma: exclui histórico importado das telas operacionais. */
export const excludeImportedOrdersWhere: Pick<Prisma.ServiceOrderWhereInput, "NOT"> = {
  NOT: {
    OR: [
      { notes: { contains: "ROTATIVO/" } },
      { notes: { contains: "LOJAS/" } },
      { notes: { contains: "Loja parceira:" } },
    ],
  },
};
