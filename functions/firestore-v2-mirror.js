/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {
  CONTROL_PATH,
  ENTRY_COLLECTION,
  PROJECTION_COLLECTION,
  READ_PROJECTION_COLLECTION,
  compactLegacyFields,
  describeSourcePath,
  diffEntries,
  isArchivedEntry,
  normalizeArchiveConfig,
  projectionItemFromEntry,
  stableStringify,
} = require("./firestore-v2-core");

const MAX_CONCURRENT_ENTRY_TRANSACTIONS = 20;

async function getMirrorControl(db) {
  const snapshot = await db.doc(CONTROL_PATH).get();
  return snapshot.exists ? snapshot.data() : null;
}

function shouldMirror(control, sourcePath = "") {
  if (!control || control.mirrorLegacyWrites !== true ||
      control.killSwitch === true) return false;
  const enabledKinds = control.enabledKinds;
  if (!Array.isArray(enabledKinds) || !enabledKinds.length || !sourcePath) {
    return true;
  }
  const descriptor = describeSourcePath(sourcePath);
  return Boolean(descriptor && enabledKinds.includes(descriptor.kind));
}

async function isMirrorEnabled(db, sourcePath = "") {
  return shouldMirror(await getMirrorControl(db), sourcePath);
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
    const previousEntry = current.exists && typeof current.data === "function" ?
      current.data() : null;
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
    if (metadata.projectionWrites === true) {
      const monthRef = sourceRef.collection(PROJECTION_COLLECTION)
          .doc(entry.monthKey || "unknown");
      const projection = projectionItemFromEntry(
          entry,
          metadata.sourceUpdateTimeMs,
      );
      const projectionData = {
        schemaVersion: 2,
        sourcePath: sourceRef.path,
        monthKey: entry.monthKey || "unknown",
        items: {[entry.id]: projection},
        updatedAt: now,
      };
      // Replace the complete item map rather than recursively merging it.
      // Otherwise a tombstone would retain the previous item's `value` leaf.
      transaction.set(monthRef, projectionData, {mergeFields: [
        "schemaVersion", "sourcePath", "monthKey", "updatedAt",
        new admin.firestore.FieldPath("items", entry.id),
      ]});
    }
    if (metadata.compactProjectionWrites === true) {
      const leafPath = (value) => value.ordinal === undefined ?
        ["maps", value.field, value.legacyKey] :
        ["arrays", value.field, value.id];
      const sameLocation = previousEntry &&
        previousEntry.monthKey === entry.monthKey &&
        previousEntry.field === entry.field &&
        previousEntry.legacyKey === entry.legacyKey &&
        (previousEntry.ordinal === undefined) === (entry.ordinal === undefined);
      if (previousEntry && previousEntry.deleted !== true &&
          (entry.deleted === true || !sameLocation)) {
        const oldMonthRef = sourceRef.collection(READ_PROJECTION_COLLECTION)
            .doc(previousEntry.monthKey || "unknown");
        transaction.update(
            oldMonthRef,
            new admin.firestore.FieldPath(...leafPath(previousEntry)),
            admin.firestore.FieldValue.delete(),
            "sourceUpdateTimeMs",
            metadata.sourceUpdateTimeMs,
            "updatedAt",
            now,
        );
      }
      if (entry.deleted !== true) {
        const monthRef = sourceRef.collection(READ_PROJECTION_COLLECTION)
            .doc(entry.monthKey || "unknown");
        const path = leafPath(entry);
        const leafValue = entry.ordinal === undefined ? entry.value : {
          ordinal: entry.ordinal,
          value: entry.value,
        };
        const data = {
          schemaVersion: 2,
          sourcePath: sourceRef.path,
          monthKey: entry.monthKey || "unknown",
          sourceUpdateTimeMs: metadata.sourceUpdateTimeMs,
          updatedAt: now,
          [path[0]]: {[path[1]]: {[path[2]]: leafValue}},
        };
        transaction.set(monthRef, data, {mergeFields: [
          "schemaVersion", "sourcePath", "monthKey", "sourceUpdateTimeMs",
          "updatedAt",
          new admin.firestore.FieldPath(...path),
        ]});
      }
    }
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

async function maybeCompactLegacySource(db, sourceRef, control) {
  if (control.legacyCompactionEnabled !== true) return false;
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sourceRef);
    if (!snapshot.exists) return false;
    const data = snapshot.data() || {};
    const archive = normalizeArchiveConfig(sourceRef.path, data);
    if (!archive) return false;
    const compacted = compactLegacyFields(sourceRef.path, data, archive);
    const changed = Object.entries(compacted).some(([field, value]) =>
      stableStringify(data[field] || {}) !== stableStringify(value));
    if (!changed) return false;
    transaction.update(sourceRef, {
      ...compacted,
      _firestoreV2Archive: {
        ...archive,
        lastCompactedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
    return true;
  });
}

async function mirrorLegacyWriteWithDb(db, change, context, now) {
  const beforeData = change.before.exists ? change.before.data() : null;
  const afterData = change.after.exists ? change.after.data() : null;
  const sourcePath = change.after.exists ? change.after.ref.path : change.before.ref.path;
  const control = await getMirrorControl(db);
  if (!shouldMirror(control, sourcePath)) return null;
  const sourceRef = change.after.exists ? change.after.ref : change.before.ref;
  const diff = diffEntries(sourcePath, beforeData, afterData);
  const archive = normalizeArchiveConfig(sourcePath, afterData);
  const upserts = diff.upserts;
  const tombstones = diff.tombstones.filter((entry) =>
    !(control.legacyCompactionEnabled === true &&
      isArchivedEntry(entry, archive)));
  const preservedArchivedEntries = diff.tombstones.length - tombstones.length;
  if (!upserts.length && !tombstones.length) {
    if (change.after.exists) {
      await maybeCompactLegacySource(db, sourceRef, control);
    }
    return null;
  }

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
    projectionWrites: control.projectionWrites === true,
    compactProjectionWrites: control.compactProjectionWrites === true,
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
  if (change.after.exists) {
    await maybeCompactLegacySource(db, sourceRef, control);
  }
  console.info("Firestore v2 shadow mirror committed", {
    sourcePath, eventId: context.eventId, upserts: upserts.length,
    tombstones: tombstones.length, preservedArchivedEntries,
    committed, sourceUpdateTimeMs,
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
  getMirrorControl,
  mirrorLegacyWrite,
  mirrorLegacyWriteWithDb,
  writeVersionedEntry,
  shouldMirror,
  maybeCompactLegacySource,
};
