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

/** Lojas cujo saldo de dívidas é lançado manualmente (não importar ledger da planilha). */
export function isManualLedgerPartner(name: string): boolean {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return n.includes("MAGRAO");
}

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

export function sumPendingPartnerWashes(
  orders: { total: number; paymentStatus: string }[]
): number {
  return orders
    .filter((o) => o.paymentStatus === "PENDENTE")
    .reduce((sum, o) => sum + o.total, 0);
}

/** Saldo = lavagens pendentes (bloco em aberto) + ledger (produtos/dívidas avulsas). */
export function computePartnerBalance(
  entries: Entry[],
  orders: { total: number; paymentStatus: string }[]
): number {
  const pendingWash = sumPendingPartnerWashes(orders);
  const ledger = entries.reduce((sum, e) => sum + partnerBalanceDelta(e.type, e.amount), 0);
  return pendingWash + ledger;
}

/** Lançamento que zera o saldo atual (positivo → pagamento; negativo → ajuste). */
export function ledgerEntryToZeroBalance(
  balance: number
): { type: PartnerEntryType; amount: number } | null {
  if (Math.abs(balance) < 0.01) return null;
  if (balance > 0) return { type: "PAGAMENTO", amount: Math.round(balance * 100) / 100 };
  return { type: "AJUSTE", amount: Math.round(-balance * 100) / 100 };
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
