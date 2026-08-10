/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {
  CONTROL_PATH,
  ENTRY_COLLECTION,
  describeSourcePath,
  diffEntries,
} = require("./firestore-v2-core");

const MAX_CONCURRENT_ENTRY_TRANSACTIONS = 20;

async function isMirrorEnabled(db, sourcePath = "") {
  const snapshot = await db.doc(CONTROL_PATH).get();
  if (!snapshot.exists || snapshot.get("mirrorLegacyWrites") !== true ||
      snapshot.get("killSwitch") === true) return false;
  const enabledKinds = snapshot.get("enabledKinds");
  if (!Array.isArray(enabledKinds) || !enabledKinds.length || !sourcePath) {
    return true;
  }
  const descriptor = describeSourcePath(sourcePath);
  return Boolean(descriptor && enabledKinds.includes(descriptor.kind));
}

async function writeVersionedEntry(db, sourceRef, item, metadata, now) {
  const entry = item.entry || item;
  const chunks = item.chunks || [];
  const entryRef = sourceRef.collection(ENTRY_COLLECTION).doc(entry.id);
  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(entryRef);
    const currentVersion = current.exists ?
      Number(current.get("sourceUpdateTimeMs") || 0) : 0;
    if (currentVersion > metadata.sourceUpdateTimeMs) return false;
    transaction.set(entryRef, {
      ...entry,
      ...metadata,
      mirroredAt: now,
    }, {merge: true});
    chunks.forEach((chunk) => {
      transaction.set(
          entryRef.collection("firestoreV2PayloadChunks").doc(chunk.id),
          {...chunk, mirroredAt: now},
          {merge: true},
      );
    });
    return true;
  });
}

async function processWithConcurrency(items, callback) {
  for (let offset = 0; offset < items.length;
    offset += MAX_CONCURRENT_ENTRY_TRANSACTIONS) {
    await Promise.all(items.slice(offset, offset + MAX_CONCURRENT_ENTRY_TRANSACTIONS)
        .map(callback));
  }
}

async function mirrorLegacyWriteWithDb(db, change, context, now) {
  const beforeData = change.before.exists ? change.before.data() : null;
  const afterData = change.after.exists ? change.after.data() : null;
  const sourcePath = change.after.exists ? change.after.ref.path : change.before.ref.path;
  if (!(await isMirrorEnabled(db, sourcePath))) return null;
  const sourceRef = change.after.exists ? change.after.ref : change.before.ref;
  const {upserts, tombstones} = diffEntries(sourcePath, beforeData, afterData);
  if (!upserts.length && !tombstones.length) return null;

  // Delete snapshots expose the last update time of the document that was
  // removed, not a distinct delete version. Use the event time for deletes so
  // a delayed update trigger cannot resurrect data after a tombstone.
  const afterUpdateTime = change.after.exists && change.after.updateTime;
  const sourceUpdateTimeMs = afterUpdateTime &&
    typeof afterUpdateTime.toMillis === "function" ?
    afterUpdateTime.toMillis() : Date.parse(context.timestamp || "") ||
      (change.before.updateTime && change.before.updateTime.toMillis()) || 0;
  const metadata = {
    mirrorEventId: context.eventId,
    sourceUpdateTimeMs,
  };
  let committed = 0;
  await processWithConcurrency(upserts, async (item) => {
    if (await writeVersionedEntry(db, sourceRef, item, metadata, now)) committed += 1;
  });
  await processWithConcurrency(tombstones, async (tombstone) => {
    const item = {
      entry: {...tombstone, value: admin.firestore.FieldValue.delete()},
      chunks: [],
    };
    if (await writeVersionedEntry(db, sourceRef, item, metadata, now)) committed += 1;
  });
  console.info("Firestore v2 shadow mirror committed", {
    sourcePath, eventId: context.eventId, upserts: upserts.length,
    tombstones: tombstones.length, committed, sourceUpdateTimeMs,
  });
  return null;
}

async function mirrorLegacyWrite(change, context) {
  return mirrorLegacyWriteWithDb(
      admin.firestore(),
      change,
      context,
      admin.firestore.FieldValue.serverTimestamp(),
  );
}

module.exports = {
  isMirrorEnabled,
  mirrorLegacyWrite,
  mirrorLegacyWriteWithDb,
  writeVersionedEntry,
};
