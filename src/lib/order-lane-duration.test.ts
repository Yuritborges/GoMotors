import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatElapsedTimer,
  formatLaneClockTime,
  getLaneEstimatedEndAt,
  getLaneEstimatedMinutes,
  isLaneOverdue,
} from "./order-lane-duration";
import { DEFAULT_DISPLAY_LANE_DURATIONS } from "./shop-settings";

test("getLaneEstimatedMinutes usa tempos das etapas fixas", () => {
  assert.equal(getLaneEstimatedMinutes("LAVAGEM", [], DEFAULT_DISPLAY_LANE_DURATIONS), 20);
  assert.equal(getLaneEstimatedMinutes("FINALIZACAO", [], DEFAULT_DISPLAY_LANE_DURATIONS), 20);
  assert.equal(getLaneEstimatedMinutes("AGUARDANDO", [], DEFAULT_DISPLAY_LANE_DURATIONS), 0);
});

test("getLaneEstimatedMinutes usa tempo do serviço extra", () => {
  const mins = getLaneEstimatedMinutes(
    "extra:polimento",
    [{ serviceName: "Polimento", estimatedMinutes: 45 }],
    DEFAULT_DISPLAY_LANE_DURATIONS
  );
  assert.equal(mins, 45);
});

test("isLaneOverdue após limite de minutos", () => {
  const entered = new Date("2026-07-07T15:00:00.000Z");
  const before = new Date("2026-07-07T15:19:00.000Z");
  const after = new Date("2026-07-07T15:21:00.000Z");
  assert.equal(isLaneOverdue(entered, 20, before), false);
  assert.equal(isLaneOverdue(entered, 20, after), true);
});

test("formatElapsedTimer", () => {
  const entered = new Date("2026-07-07T15:00:00.000Z");
  const now = new Date("2026-07-07T15:05:07.000Z");
  assert.equal(formatElapsedTimer(entered, now), "05:07");
});

test("formatLaneClockTime e previsão de término em Brasília", () => {
  const entered = new Date("2026-07-07T18:00:00.000Z"); // 15:00 BRT (winter? Actually July is -3, so 15:00)
  assert.equal(formatLaneClockTime(entered), "15:00");
  const end = getLaneEstimatedEndAt(entered, 20);
  assert.equal(formatLaneClockTime(end), "15:20");
});
