#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
"use strict";

const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const {
  CONTROL_PATH,
  READ_PROJECTION_COLLECTION,
} = require("../firestore-v2-core");
const {mirrorLegacyWriteWithDb} = require("../firestore-v2-mirror");
const {runRetentionCycle} = require("../firestore-v2-retention");
const {
  COMPACT_ACK,
  ROLLBACK_ACK,
  compact,
  rollback,
  verify,
} = require("./firestore-v2-cutover");

const SOURCE_PATH = "gallery/codex_firestore_v2_cutover_smoke";

async function mirrorChange(db, before, after, eventId) {
  await mirrorLegacyWriteWithDb(
      db,
      {before, after},
      {eventId, timestamp: new Date().toISOString()},
      admin.firestore.FieldValue.serverTimestamp(),
  );
}

async function main() {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
  if (!process.env.FIRESTORE_EMULATOR_HOST || !project.startsWith("demo-")) {
    throw new Error("This smoke test requires the Firestore emulator and a demo-* project.");
  }
  admin.initializeApp({projectId: project});
  const db = admin.firestore();
  const sourceRef = db.doc(SOURCE_PATH);
  await db.recursiveDelete(sourceRef);
  await db.doc(CONTROL_PATH).set({
    mirrorLegacyWrites: true,
    projectionWrites: true,
    compactProjectionWrites: true,
    legacyCompactionEnabled: false,
    readFromV2: true,
    readKinds: ["gallery"],
    killSwitch: false,
  });
  const initial = {
    label: "cutover-smoke",
    galleryPictures: {
      old: {url: "old", uploadedAt: "2025-12-01T00:00:00Z"},
      recent: {url: "recent", uploadedAt: "2026-08-01T00:00:00Z"},
    },
  };

  try {
    const missing = await sourceRef.get();
    await sourceRef.set(initial);
    const created = await sourceRef.get();
    await mirrorChange(db, missing, created, "create");

    const beforeCompact = await verify(db, {source: SOURCE_PATH});
    assert.equal(beforeCompact.projectionExact, true);
    const compactResult = await compact(db, {
      project,
      source: SOURCE_PATH,
      through: "2025-12",
      fields: ["galleryPictures"],
      retentionMonths: 2,
      ack: COMPACT_ACK,
    });
    assert.equal(compactResult.exactLogicalMatch, true);
    const retentionResult = await runRetentionCycle(
        db,
        new Date("2026-08-14T04:00:00Z"),
    );
    assert.equal(retentionResult.skipped, false);
    assert.equal(retentionResult.results[0].through, "2026-06");
    let compacted = await sourceRef.get();
    assert.equal(compacted.get("galleryPictures.old"), undefined);
    assert.equal(compacted.get("galleryPictures.recent.url"), "recent");

    const beforeArchivedUpdate = compacted;
    await sourceRef.set({
      galleryPictures: {
        old: {url: "old-updated", uploadedAt: "2025-12-01T00:00:00Z"},
      },
    }, {merge: true});
    const afterArchivedUpdate = await sourceRef.get();
    await mirrorChange(
        db,
        beforeArchivedUpdate,
        afterArchivedUpdate,
        "archived-update",
    );
    compacted = await sourceRef.get();
    assert.equal(compacted.get("galleryPictures.old"), undefined);
    const compactMonth = await sourceRef.collection(READ_PROJECTION_COLLECTION)
        .doc("2025-12").get();
    assert.equal(compactMonth.get("maps.galleryPictures.old.url"), "old-updated");

    const rollbackResult = await rollback(db, {
      project,
      source: SOURCE_PATH,
      ack: ROLLBACK_ACK,
    });
    assert.equal(rollbackResult.exactLegacyMatch, true);
    const restored = await sourceRef.get();
    assert.equal(restored.get("galleryPictures.old.url"), "old-updated");
    assert.equal(restored.get("galleryPictures.recent.url"), "recent");
    assert.equal(restored.get("_firestoreV2Archive"), undefined);
    const control = await db.doc(CONTROL_PATH).get();
    assert.equal(control.get("readFromV2"), false);
    assert.equal(control.get("legacyCompactionEnabled"), false);

    console.log(JSON.stringify({
      success: true,
      compactExact: true,
      rollingRetentionExact: true,
      archivedWriteRecompacted: true,
      rollbackExact: true,
      legacyReadRestored: true,
    }, null, 2));
  } finally {
    await db.recursiveDelete(sourceRef);
    await db.doc(CONTROL_PATH).delete();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}
