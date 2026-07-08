import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSalaryRemaining } from "./employee-salary.ts";

test("computeSalaryRemaining abate vales e inicia novo ciclo após pagamento", () => {
  const base = 2200;
  const txs = [
    { type: "VALE" as const, amount: 300, date: new Date("2026-07-01") },
    { type: "DESCONTO" as const, amount: 100, date: new Date("2026-07-05") },
    { type: "PAGAMENTO_SALARIO" as const, amount: 1800, date: new Date("2026-07-20") },
    { type: "VALE" as const, amount: 200, date: new Date("2026-07-22") },
  ];
  assert.equal(computeSalaryRemaining(base, txs), 2000);
});

test("computeSalaryRemaining fica zero após pagamento do ciclo", () => {
  const base = 2200;
  const txs = [
    { type: "VALE" as const, amount: 300, date: new Date("2026-07-01") },
    { type: "DESCONTO" as const, amount: 100, date: new Date("2026-07-05") },
    { type: "PAGAMENTO_SALARIO" as const, amount: 1800, date: new Date("2026-07-20") },
  ];
  assert.equal(computeSalaryRemaining(base, txs), 0);
});

test("parseRotativoDate usa mês da aba JANEIRO", async () => {
  const { parseRotativoDate } = await import("../../scripts/import-utils.ts");
  const d = parseRotativoDate("1/5/26", "JANEIRO", 2026);
  assert.ok(d);
  assert.equal(d!.getFullYear(), 2026);
  assert.equal(d!.getMonth(), 0);
  assert.equal(d!.getDate(), 5);
});
