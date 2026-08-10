"use strict";
/* eslint-disable max-len */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_INLINE_PAYLOAD_BYTES,
  describeSourcePath,
  diffEntries,
  materializeEntries,
  monthKeyFromLegacyKey,
  reconstructLegacyFields,
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
