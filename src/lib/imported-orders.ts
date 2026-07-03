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

/**
 * Filtro Prisma: só ordens operacionais (criadas no app).
 * NOT/OR com `contains` exclui notes NULL no Postgres — por isso usamos OR explícito.
 */
export const operationalOrdersWhere: Prisma.ServiceOrderWhereInput = {
  OR: [
    { notes: null },
    {
      AND: [
        { notes: { not: { contains: "ROTATIVO/" } } },
        { notes: { not: { contains: "LOJAS/" } } },
        { notes: { not: { contains: "Loja parceira:" } } },
      ],
    },
  ],
};

/** @deprecated Use operationalOrdersWhere */
export const excludeImportedOrdersWhere = operationalOrdersWhere;
