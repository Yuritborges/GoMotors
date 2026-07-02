import type { PartnerEntryType } from "@/generated/prisma/client";

export const PARTNER_ENTRY_LABELS: Record<PartnerEntryType, string> = {
  DIVIDA: "Dívida",
  PRODUTO: "Produto",
  PARCELA: "Parcela paga",
  PAGAMENTO: "Pagamento",
  AJUSTE: "Ajuste",
};

export const PARTNER_ENTRY_HINTS: Record<PartnerEntryType, string> = {
  DIVIDA: "Valor que a loja deve (aumenta saldo devedor)",
  PRODUTO: "Produto/peça emprestada ou vendida à loja",
  PARCELA: "Parcela recebida de um parcelamento",
  PAGAMENTO: "Pagamento recebido da loja (reduz dívida)",
  AJUSTE: "Ajuste manual de saldo",
};

type Entry = { type: PartnerEntryType; amount: number };

/** Saldo positivo = loja deve ao Go Motors */
export function partnerBalanceDelta(type: PartnerEntryType, amount: number): number {
  switch (type) {
    case "PAGAMENTO":
    case "PARCELA":
      return -amount;
    case "DIVIDA":
    case "PRODUTO":
    case "AJUSTE":
      return amount;
  }
}

export function computePartnerBalance(entries: Entry[], washTotal = 0): number {
  const ledger = entries.reduce((sum, e) => sum + partnerBalanceDelta(e.type, e.amount), 0);
  return washTotal + ledger;
}

export function summarizePartnerEntries(entries: Entry[]) {
  const totals = { DIVIDA: 0, PRODUTO: 0, PARCELA: 0, PAGAMENTO: 0, AJUSTE: 0 };
  for (const e of entries) totals[e.type] += e.amount;
  return {
    dividas: totals.DIVIDA,
    produtos: totals.PRODUTO,
    parcelas: totals.PARCELA,
    pagamentos: totals.PAGAMENTO + totals.PARCELA,
    ajustes: totals.AJUSTE,
    ledgerDebit: totals.DIVIDA + totals.PRODUTO + totals.AJUSTE,
    ledgerCredit: totals.PAGAMENTO + totals.PARCELA,
  };
}
