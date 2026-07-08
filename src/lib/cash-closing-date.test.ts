import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cashClosingDisplayKey,
  cashClosingStorageDate,
  cashClosingUtcDayRange,
  normalizeCashDateKey,
} from "./cash-closing-date";

test("cashClosingStorageDate usa meio-dia UTC estável", () => {
  const stored = cashClosingStorageDate("2026-07-07");
  assert.equal(stored.toISOString(), "2026-07-07T12:00:00.000Z");
  assert.equal(cashClosingDisplayKey(stored), "2026-07-07");
});

test("cashClosingUtcDayRange inclui fechamento legado em BRT (03:00 UTC)", () => {
  const legacy = new Date("2026-07-07T03:00:00.000Z");
  const { start, end } = cashClosingUtcDayRange("2026-07-07");
  assert.ok(legacy >= start && legacy < end);
});

test("normalizeCashDateKey preserva parâmetro válido", () => {
  assert.equal(normalizeCashDateKey("2026-07-07"), "2026-07-07");
});
