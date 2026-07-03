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
export const excludeImportedOrdersWhere = {
  NOT: {
    OR: [
      { notes: { contains: "ROTATIVO/" } },
      { notes: { contains: "LOJAS/" } },
      { notes: { contains: "Loja parceira:" } },
    ],
  },
} as const;
