"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeRetentionSource,
  retentionCutoff,
} = require("../firestore-v2-retention");

test("rolling retention keeps the requested number of calendar months", () => {
  assert.equal(retentionCutoff(new Date("2026-08-14T04:00:00Z"), 2), "2026-06");
  assert.equal(retentionCutoff(new Date("2026-01-01T00:00:00Z"), 3), "2025-10");
});

test("retention config is explicit, bounded, and layout validated", () => {
  assert.deepEqual(normalizeRetentionSource({
    source: "management/main",
    retentionMonths: 2,
    fields: ["reserve", "moneyInHandsActivities", "reserve", "notAField"],
  }), {
    source: "management/main",
    kind: "management",
    retentionMonths: 2,
    fields: ["moneyInHandsActivities", "reserve"],
  });
  assert.equal(normalizeRetentionSource({
    source: "management/main",
    retentionMonths: 0,
    fields: ["reserve"],
  }), null);
  assert.equal(normalizeRetentionSource({
    source: "unsupported/main",
    retentionMonths: 2,
    fields: ["reserve"],
  }), null);
});
