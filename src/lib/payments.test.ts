import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canDeliverWithPendingPayment,
  isDeferredPaymentMethod,
  isSettlementPaymentMethod,
  paymentStatusForMethod,
} from "./payments";

describe("payments", () => {
  it("marca PIX como pago na criação", () => {
    assert.equal(paymentStatusForMethod("PIX"), "PAGO");
  });

  it("marca pagar depois como pendente", () => {
    assert.equal(paymentStatusForMethod("PAGAR_DEPOIS"), "PENDENTE");
  });

  it("identifica métodos adiados", () => {
    assert.equal(isDeferredPaymentMethod("FECHAMENTO_MENSAL"), true);
    assert.equal(isDeferredPaymentMethod("PIX"), false);
  });

  it("identifica métodos de baixa no caixa", () => {
    assert.equal(isSettlementPaymentMethod("CREDITO"), true);
    assert.equal(isSettlementPaymentMethod("PAGAR_DEPOIS"), false);
  });

  it("permite liberar veículo com mensalidade pendente", () => {
    assert.equal(canDeliverWithPendingPayment("FECHAMENTO_MENSAL"), true);
    assert.equal(canDeliverWithPendingPayment("PAGAR_DEPOIS"), false);
  });
});
