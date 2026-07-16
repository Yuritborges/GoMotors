import type { Prisma } from "../generated/prisma/client";

/** Ordens criadas pelo import das planilhas (histórico), não pela operação diária. */
export function isImportedHistoricalOrder(notes: string | null | undefined): boolean {
  if (!notes) return false;
  const n = notes.toLocaleUpperCase("pt-BR");
  return (
    n.includes("ROTATIVO/") ||
    n.includes("LOJAS/") ||
    n.includes("LOJA PARCEIRA:")
  );
}

/**
 * Filtro Prisma: só ordens operacionais (criadas no app).
 * NOT/OR com `contains` exclui notes NULL no Postgres — por isso usamos OR explícito.
 * Marcadores em maiúscula (padronização de texto no banco).
 */
export const operationalOrdersWhere: Prisma.ServiceOrderWhereInput = {
  OR: [
    { notes: null },
    {
      AND: [
        { notes: { not: { contains: "ROTATIVO/" } } },
        { notes: { not: { contains: "LOJAS/" } } },
        { notes: { not: { contains: "LOJA PARCEIRA:" } } },
      ],
    },
  ],
};

/** @deprecated Use operationalOrdersWhere */
export const excludeImportedOrdersWhere = operationalOrdersWhere;
