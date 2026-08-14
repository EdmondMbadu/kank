"use strict";
/* eslint-disable max-len */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_INLINE_PAYLOAD_BYTES,
  buildCompactMonthProjections,
  buildMonthProjections,
  compactLegacyFields,
  describeSourcePath,
  diffEntries,
  flattenLatestProjectionItems,
  materializeEntries,
  monthKeyFromLegacyKey,
  normalizeArchiveConfig,
  projectionItemFromEntry,
  reconstructLegacyFields,
  reconstructCompactLegacyFields,
  isArchivedEntry,
  splitUtf8,
  stableStringify,
} = require("../firestore-v2-core");
const {APPLY_ACK, parseArgs} = require("../scripts/firestore-v2-migrate");

test("describes every supported legacy document path", () => {
  assert.deepEqual(describeSourcePath("management/main"), {
    kind: "management", entityId: "main", ownerUid: null,
  });
  assert.deepEqual(describeSourcePath("users/u1/employees/e1"), {
    kind: "employee", entityId: "e1", ownerUid: "u1",
  });
  assert.deepEqual(describeSourcePath("users/u1/clients/c1"), {
    kind: "client", entityId: "c1", ownerUid: "u1",
  });
  assert.equal(describeSourcePath("unsupported/x/y"), null);
});

test("stableStringify is insensitive to object key order", () => {
  assert.equal(stableStringify({b: 2, a: {d: 4, c: 3}}),
      stableStringify({a: {c: 3, d: 4}, b: 2}));
});

test("extracts month keys without relying on one legacy date format", () => {
  assert.equal(monthKeyFromLegacyKey("08-09-2026-12", "1"), "2026-08");
  assert.equal(monthKeyFromLegacyKey("2025-11-04", "1"), "2025-11");
  assert.equal(monthKeyFromLegacyKey("key", {createdAt: "2024-03-12T01:00:00Z"}), "2024-03");
  assert.equal(monthKeyFromLegacyKey("unknown", {}), "unknown");
});

test("materialization is deterministic and keeps one document per map entry", () => {
  const first = materializeEntries("users/u1", {
    dailyReimbursement: {"08-09-2026": "20", "08-08-2026": "10"},
  });
  const second = materializeEntries("users/u1", {
    dailyReimbursement: {"08-08-2026": "10", "08-09-2026": "20"},
  });
  assert.equal(first.length, 2);
  assert.deepEqual(first.map((item) => item.entry.id), second.map((item) => item.entry.id));
  assert.ok(first.every((item) => item.entry.ownerUid === "u1"));
});

test("diff emits only changed entries and tombstones removed entries", () => {
  const result = diffEntries("management/main",
      {reserve: {a: "1", b: "2"}},
      {reserve: {a: "1", b: "3", c: "4"}});
  assert.equal(result.upserts.length, 2);
  assert.equal(result.tombstones.length, 0);

  const removed = diffEntries("management/main", {reserve: {a: "1"}}, {reserve: {}});
  assert.equal(removed.upserts.length, 0);
  assert.equal(removed.tombstones.length, 1);
  assert.equal(removed.tombstones[0].deleted, true);
});

test("supported maps and arrays make an exact compatibility round trip", () => {
  const sourcePath = "users/u1/clients/c1";
  const legacy = {
    payments: {"08-08-2026": "10", "08-09-2026": "20"},
    bonusHistory: {bonus1: {amount: "5", createdAt: "2026-08-09"}},
    comments: [
      {time: "2026-08-09T10:00:00Z", comment: "first"},
      {time: "2026-08-09T10:00:00Z", comment: "same time, distinct"},
    ],
  };
  const entries = materializeEntries(sourcePath, legacy).map((item) => item.entry);
  const reconstructed = reconstructLegacyFields(sourcePath, entries);
  assert.deepEqual(reconstructed, legacy);
});

test("month projections preserve exact compatibility values", () => {
  const sourcePath = "management/main";
  const legacy = {
    reserve: {"08-13-2026": "25", "07-31-2026": "10"},
    moneyInHandsActivities: {
      "08-13-2026-1": {createdAt: "2026-08-13T10:00:00Z", newAmount: "25"},
    },
  };
  const projections = buildMonthProjections(sourcePath, legacy, 500);
  assert.deepEqual([...projections.keys()].sort(), ["2026-07", "2026-08"]);
  const augustEntries = Object.values(projections.get("2026-08"));
  const reconstructed = reconstructLegacyFields(sourcePath, augustEntries);
  assert.equal(reconstructed.reserve["08-13-2026"], "25");
  assert.equal(reconstructed.moneyInHandsActivities["08-13-2026-1"].newAmount, "25");
  assert.ok(augustEntries.every((entry) => entry.sourceUpdateTimeMs === 500));
});

test("compact month projections preserve exact maps and ordered arrays", () => {
  const sourcePath = "management/main";
  const source = {
    id: "main",
    reserve: {"08-01-2026": "5", "08-02-2026": "7"},
    weeklyPaymentTargetPeriods: [{id: "a"}, {id: "b"}],
  };
  const projections = buildCompactMonthProjections(sourcePath, source);
  const reconstructed = reconstructCompactLegacyFields(
      sourcePath,
      [...projections.values()],
      {id: "main"},
  );
  assert.deepEqual(reconstructed, source);
});

test("legacy compaction retains recent and unknown keys and archives only configured fields", () => {
  const sourcePath = "management/main";
  const source = {
    reserve: {"12-31-2025": "old", "08-13-2026": "new", "custom": "keep"},
    expenses: {"12-31-2025": "editable"},
    _firestoreV2Archive: {through: "2025-12", fields: ["reserve"]},
  };
  const archive = normalizeArchiveConfig(sourcePath, source);
  assert.deepEqual(archive, {through: "2025-12", fields: ["reserve"]});
  assert.deepEqual(compactLegacyFields(sourcePath, source, archive), {
    reserve: {"08-13-2026": "new", "custom": "keep"},
  });
  assert.equal(isArchivedEntry({field: "reserve", monthKey: "2025-12"}, archive), true);
  assert.equal(isArchivedEntry({field: "expenses", monthKey: "2025-12"}, archive), false);
  assert.equal(isArchivedEntry({field: "reserve", monthKey: "unknown"}, archive), false);
});

test("tombstones clear arrays and never place delete sentinels in projections", () => {
  const sourcePath = "users/u1/reviews/r1";
  const result = reconstructLegacyFields(sourcePath, [{
    sourcePath,
    field: "reviews",
    legacyKey: "old",
    ordinal: 0,
    deleted: true,
  }], {reviews: [{id: "stale"}]});
  assert.deepEqual(result.reviews, []);
  const projection = projectionItemFromEntry({
    id: "old",
    sourcePath,
    field: "reviews",
    legacyKey: "old",
    monthKey: "2026-08",
    fingerprint: "x",
    deleted: true,
    value: {deleteSentinel: true},
  }, 10);
  assert.equal(Object.prototype.hasOwnProperty.call(projection, "value"), false);
});

test("projection flattening chooses the latest item across month moves", () => {
  const sourcePath = "management/main";
  const entries = flattenLatestProjectionItems(sourcePath, [
    {items: {same: {
      id: "same", sourcePath, field: "reserve", legacyKey: "day",
      fingerprint: "old", sourceUpdateTimeMs: 10, value: "old",
    }}},
    {items: {same: {
      id: "same", sourcePath, field: "reserve", legacyKey: "day",
      fingerprint: "new", sourceUpdateTimeMs: 20, value: "new",
    }}},
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].value, "new");
});

test("oversized values are bounded into UTF-8 safe chunks", () => {
  const huge = "🙂".repeat(MAX_INLINE_PAYLOAD_BYTES);
  const [result] = materializeEntries("gallery/trophy", {galleryPictures: {huge}});
  assert.equal(result.entry.value, undefined);
  assert.ok(result.entry.chunkCount > 1);
  assert.equal(result.chunks.map((chunk) => chunk.data).join(""), stableStringify(huge));
  for (const chunk of result.chunks) {
    assert.ok(Buffer.byteLength(chunk.data, "utf8") <= 96 * 1024);
  }
  assert.deepEqual(splitUtf8("a🙂b", 4), ["a", "🙂", "b"]);
});

test("migration CLI is dry-run by default and requires an explicit apply acknowledgement", () => {
  assert.deepEqual(parseArgs(["--project", "demo"]), {
    apply: false, project: "demo", ack: "", limit: 0,
  });
  assert.deepEqual(parseArgs(["--project", "demo", "--apply", "--ack", APPLY_ACK, "--limit", "3"]), {
    apply: true, project: "demo", ack: APPLY_ACK, limit: 3,
  });
});
