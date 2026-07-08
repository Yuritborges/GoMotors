import { test } from "node:test";
import assert from "node:assert/strict";
import {
  businessDateKey,
  businessDateKeyFromInstant,
  businessDayBounds,
  businessZonedTimeToUtc,
  parseBusinessDateInput,
} from "./business-day";

test("businessDayBounds cobre noite de 07/07 em BRT (01:00 UTC do dia 08)", () => {
  const { start, end } = businessDayBounds("2026-07-07");
  const paymentAtNight = new Date("2026-07-08T01:00:00.000Z"); // ~22h BRT do dia 07
  assert.ok(paymentAtNight >= start && paymentAtNight <= end);
});

test("pagamento às 22h BRT do dia 07 não entra no dia 08", () => {
  const { start, end } = businessDayBounds("2026-07-08");
  const paymentAtNight = new Date("2026-07-08T01:00:00.000Z");
  assert.equal(paymentAtNight >= start && paymentAtNight <= end, false);
});

test("parseBusinessDateInput ancora no dia escolhido em SP", () => {
  const stored = parseBusinessDateInput("2026-07-07");
  assert.equal(businessDateKeyFromInstant(stored), "2026-07-07");
});

test("businessDateKey usa calendário de São Paulo", () => {
  const instant = new Date("2026-07-08T01:30:00.000Z"); // 22:30 do dia 07 em BRT
  assert.equal(businessDateKey(instant), "2026-07-07");
});

test("businessZonedTimeToUtc meio-dia SP em julho", () => {
  assert.equal(
    businessZonedTimeToUtc("2026-07-07", "12:00:00.000").toISOString(),
    "2026-07-07T15:00:00.000Z"
  );
});
