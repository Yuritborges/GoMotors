/** Formas de pagamento adiado — não geram receita nem entram no lucro até a baixa. */
export const DEFERRED_PAYMENT_METHODS = ["PENDENTE", "PAGAR_DEPOIS"] as const;

/** Opções exibidas ao registrar uma nova ordem. */
export const ORDER_PAYMENT_METHODS = [
  "PIX",
  "DINHEIRO",
  "DEBITO",
  "CREDITO",
  "PAGAR_DEPOIS",
] as const;

export function isDeferredPaymentMethod(method: string): boolean {
  return (DEFERRED_PAYMENT_METHODS as readonly string[]).includes(method);
}

export function paymentStatusForMethod(method: string): "PAGO" | "PENDENTE" {
  return isDeferredPaymentMethod(method) ? "PENDENTE" : "PAGO";
}
