#!/usr/bin/env node
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {
  CONTROL_PATH,
  ENTRY_COLLECTION,
  PROJECTION_COLLECTION,
  READ_PROJECTION_COLLECTION,
  buildCompactMonthProjections,
  buildMonthProjections,
  materializeEntries,
  stableStringify,
} = require("../firestore-v2-core");

const APPLY_ACK = "I_UNDERSTAND_THIS_ADDS_V2_DOCUMENTS";
const RECONCILE_CONCURRENCY = 20;
// Leave substantial headroom below Firestore's 1 MiB document limit for
// field-name/protobuf overhead and future metadata.
const MAX_PROJECTION_JSON_BYTES = 700 * 1024;

function parseArgs(argv) {
  const args = {apply: false, project: "", ack: "", limit: 0};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--project") args.project = argv[++index] || "";
    else if (arg === "--ack") args.ack = argv[++index] || "";
    else if (arg === "--limit") args.limit = Number(argv[++index] || 0);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    "Firestore v2 additive backfill and reconciliation",
    "",
    "Dry run (default):",
    "  node scripts/firestore-v2-migrate.js --project PROJECT_ID",
    "",
    "Apply missing/mismatched v2 entries (never deletes legacy data):",
    `  node scripts/firestore-v2-migrate.js --project PROJECT_ID --apply --ack ${APPLY_ACK}`,
    "",
    "Optional: --limit N limits source documents for a canary.",
  ].join("\n");
}

async function listSourceDocuments(db, limit) {
  const specs = [
    {type: "collection", name: "management"},
    {type: "collection", name: "users"},
    {type: "group", name: "employees"},
    {type: "group", name: "clients"},
    {type: "group", name: "cards"},
    {type: "group", name: "reviews"},
    {type: "collection", name: "certificate"},
    {type: "collection", name: "gallery"},
    {type: "collection", name: "audit"},
  ];
  const documents = [];
  for (const spec of specs) {
    let query = spec.type === "group" ? db.collectionGroup(spec.name) : db.collection(spec.name);
    if (limit > 0) query = query.limit(Math.max(0, limit - documents.length));
    const snapshot = await query.get();
    snapshot.docs.forEach((doc) => documents.push(doc));
    if (limit > 0 && documents.length >= limit) break;
  }
  return documents;
}

async function writeProjectionBackfill(projectionRef, items) {
  return projectionRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(projectionRef);
    const currentItems = snapshot.exists && snapshot.get("items") &&
      typeof snapshot.get("items") === "object" ? snapshot.get("items") : {};
    const mergedItems = {...currentItems};
    let changed = false;
    for (const [id, item] of Object.entries(items)) {
      const current = currentItems[id];
      const currentVersion = Number(current && current.sourceUpdateTimeMs || 0);
      const expectedVersion = Number(item.sourceUpdateTimeMs || 0);
      if (!current || currentVersion <= expectedVersion) {
        const matches = current && current.deleted === item.deleted &&
          current.fingerprint === item.fingerprint &&
          current.ordinal === item.ordinal;
        if (!matches) changed = true;
        mergedItems[id] = item;
      }
    }
    if (!changed) return false;
    transaction.set(projectionRef, {
      schemaVersion: 2,
      sourcePath: projectionRef.parent.parent.path,
      monthKey: projectionRef.id,
      items: mergedItems,
      backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      backfillVersion: 1,
    }, {merge: true});
    return true;
  });
}

async function writeCompactProjectionBackfill(
    projectionRef,
    projection,
    sourceUpdateTimeMs,
) {
  return projectionRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(projectionRef);
    const currentVersion = snapshot.exists ?
      Number(snapshot.get("sourceUpdateTimeMs") || 0) : 0;
    if (currentVersion > sourceUpdateTimeMs) return false;
    transaction.set(projectionRef, {
      schemaVersion: 2,
      sourcePath: projectionRef.parent.parent.path,
      monthKey: projectionRef.id,
      sourceUpdateTimeMs,
      maps: projection.maps,
      arrays: projection.arrays,
      backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      backfillVersion: 1,
    });
    return true;
  });
}

function compactItemCount(projection) {
  const countValues = (groups) => Object.values(groups || {})
      .reduce((total, values) => total + Object.keys(values || {}).length, 0);
  return countValues(projection.maps) + countValues(projection.arrays);
}

async function reconcileDocument(doc, apply, bulkWriter, stats) {
  const expected = materializeEntries(doc.ref.path, doc.data());
  const sourceUpdateTimeMs = doc.updateTime &&
    typeof doc.updateTime.toMillis === "function" ?
    doc.updateTime.toMillis() : 0;
  const expectedProjections = buildMonthProjections(
      doc.ref.path,
      doc.data(),
      sourceUpdateTimeMs,
  );
  const expectedCompactProjections = buildCompactMonthProjections(
      doc.ref.path,
      doc.data(),
  );
  stats.sourceDocuments += 1;
  stats.expectedEntries += expected.length;
  stats.expectedChunkedEntries += expected.filter((item) => item.chunks.length)
      .length;

  const actualSnapshot = await doc.ref.collection(ENTRY_COLLECTION).get();
  const actual = new Map(actualSnapshot.docs.map((entryDoc) => [entryDoc.id, entryDoc.data()]));
  const expectedIds = new Set();

  for (const item of expected) {
    expectedIds.add(item.entry.id);
    const current = actual.get(item.entry.id);
    const matches = current && current.deleted !== true &&
      current.fingerprint === item.entry.fingerprint &&
      (current.ordinal === item.entry.ordinal ||
        (current.ordinal === undefined && item.entry.ordinal === undefined));
    if (matches) {
      stats.matchingEntries += 1;
      continue;
    }
    if (current) stats.mismatchedEntries += 1;
    else stats.missingEntries += 1;
    if (!apply) continue;

    const entryRef = doc.ref.collection(ENTRY_COLLECTION).doc(item.entry.id);
    bulkWriter.set(entryRef, {
      ...item.entry,
      backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      backfillVersion: 1,
    }, {merge: true});
    stats.scheduledWrites += 1;
    for (const chunk of item.chunks) {
      bulkWriter.set(entryRef.collection("firestoreV2PayloadChunks").doc(chunk.id), {
        ...chunk,
        backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      stats.scheduledWrites += 1;
    }
  }

  actual.forEach((value, id) => {
    if (!expectedIds.has(id) && value.deleted !== true) stats.orphanEntries += 1;
  });

  const projectionSnapshot = await doc.ref.collection(PROJECTION_COLLECTION).get();
  const actualProjectionItems = new Map();
  projectionSnapshot.docs.forEach((projectionDoc) => {
    const items = projectionDoc.get("items");
    if (!items || typeof items !== "object" || Array.isArray(items)) return;
    Object.entries(items).forEach(([id, item]) => {
      actualProjectionItems.set(id, item);
    });
  });
  const expectedProjectionIds = new Set();
  for (const [monthKey, items] of expectedProjections) {
    const projectionBytes = Buffer.byteLength(
        stableStringify({items}),
        "utf8",
    );
    stats.expectedProjectionDocuments += 1;
    stats.expectedProjectionItems += Object.keys(items).length;
    stats.largestProjectionJsonBytes = Math.max(
        stats.largestProjectionJsonBytes,
        projectionBytes,
    );
    if (projectionBytes > MAX_PROJECTION_JSON_BYTES) {
      stats.oversizedProjectionDocuments += 1;
      continue;
    }

    let projectionNeedsWrite = false;
    for (const [id, item] of Object.entries(items)) {
      expectedProjectionIds.add(id);
      const current = actualProjectionItems.get(id);
      const matches = current && current.deleted !== true &&
        current.fingerprint === item.fingerprint &&
        current.field === item.field &&
        current.legacyKey === item.legacyKey &&
        (current.ordinal === item.ordinal ||
          (current.ordinal === undefined && item.ordinal === undefined));
      if (matches) stats.matchingProjectionItems += 1;
      else if (current) {
        stats.mismatchedProjectionItems += 1;
        projectionNeedsWrite = true;
      } else {
        stats.missingProjectionItems += 1;
        projectionNeedsWrite = true;
      }
    }

    if (apply && projectionNeedsWrite) {
      const wrote = await writeProjectionBackfill(
          doc.ref.collection(PROJECTION_COLLECTION).doc(monthKey),
          items,
      );
      if (wrote) stats.scheduledWrites += 1;
    }
  }
  actualProjectionItems.forEach((value, id) => {
    if (!expectedProjectionIds.has(id) && value.deleted !== true) {
      stats.orphanProjectionItems += 1;
    }
  });

  const compactSnapshot = await doc.ref.collection(READ_PROJECTION_COLLECTION)
      .get();
  const actualCompact = new Map(
      compactSnapshot.docs.map((compactDoc) => [compactDoc.id, compactDoc.data()]),
  );
  for (const [monthKey, projection] of expectedCompactProjections) {
    const projectionBytes = Buffer.byteLength(stableStringify(projection), "utf8");
    stats.expectedCompactProjectionDocuments += 1;
    stats.expectedCompactProjectionItems += compactItemCount(projection);
    stats.largestCompactProjectionJsonBytes = Math.max(
        stats.largestCompactProjectionJsonBytes,
        projectionBytes,
    );
    if (projectionBytes > MAX_PROJECTION_JSON_BYTES) {
      stats.oversizedCompactProjectionDocuments += 1;
      continue;
    }
    const current = actualCompact.get(monthKey);
    const matches = current && stableStringify({
      maps: current.maps || {}, arrays: current.arrays || {},
    }) === stableStringify(projection);
    if (matches) {
      stats.matchingCompactProjectionDocuments += 1;
      stats.matchingCompactProjectionItems += compactItemCount(projection);
    } else if (current) {
      stats.mismatchedCompactProjectionDocuments += 1;
    } else {
      stats.missingCompactProjectionDocuments += 1;
    }
    if (apply && !matches) {
      const wrote = await writeCompactProjectionBackfill(
          doc.ref.collection(READ_PROJECTION_COLLECTION).doc(monthKey),
          projection,
          sourceUpdateTimeMs,
      );
      if (wrote) stats.scheduledWrites += 1;
      else stats.skippedNewerCompactProjectionWrites += 1;
    }
  }
  actualCompact.forEach((value, monthKey) => {
    if (!expectedCompactProjections.has(monthKey) && compactItemCount(value)) {
      stats.orphanCompactProjectionDocuments += 1;
    }
  });
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.project) throw new Error("--project is required; implicit projects are not allowed.");
  if (args.apply && args.ack !== APPLY_ACK) {
    throw new Error(`Apply mode requires --ack ${APPLY_ACK}`);
  }

  admin.initializeApp({projectId: args.project});
  const db = admin.firestore();
  const controlSnapshot = await db.doc(CONTROL_PATH).get();
  const control = controlSnapshot.exists ? controlSnapshot.data() : {};
  if (args.apply && (control.killSwitch === true ||
      control.mirrorLegacyWrites !== true || control.projectionWrites !== true ||
      control.compactProjectionWrites !== true)) {
    throw new Error("Apply mode requires mirrorLegacyWrites=true, projectionWrites=true, compactProjectionWrites=true, and killSwitch=false to prevent a moving-data gap.");
  }

  const stats = {
    mode: args.apply ? "apply" : "dry-run",
    project: args.project,
    sourceDocuments: 0,
    expectedEntries: 0,
    expectedChunkedEntries: 0,
    matchingEntries: 0,
    missingEntries: 0,
    mismatchedEntries: 0,
    orphanEntries: 0,
    expectedProjectionDocuments: 0,
    expectedProjectionItems: 0,
    matchingProjectionItems: 0,
    missingProjectionItems: 0,
    mismatchedProjectionItems: 0,
    orphanProjectionItems: 0,
    oversizedProjectionDocuments: 0,
    largestProjectionJsonBytes: 0,
    expectedCompactProjectionDocuments: 0,
    expectedCompactProjectionItems: 0,
    matchingCompactProjectionDocuments: 0,
    matchingCompactProjectionItems: 0,
    missingCompactProjectionDocuments: 0,
    mismatchedCompactProjectionDocuments: 0,
    orphanCompactProjectionDocuments: 0,
    oversizedCompactProjectionDocuments: 0,
    largestCompactProjectionJsonBytes: 0,
    skippedNewerCompactProjectionWrites: 0,
    scheduledWrites: 0,
  };
  const bulkWriter = args.apply ? db.bulkWriter() : null;
  if (bulkWriter) {
    bulkWriter.onWriteError((error) => error.failedAttempts < 5);
  }

  const documents = await listSourceDocuments(db, args.limit);
  for (let offset = 0; offset < documents.length;
    offset += RECONCILE_CONCURRENCY) {
    await Promise.all(documents.slice(offset, offset + RECONCILE_CONCURRENCY)
        .map((doc) => reconcileDocument(doc, args.apply, bulkWriter, stats)));
  }
  if (bulkWriter) await bulkWriter.close();

  console.log(JSON.stringify(stats, null, 2));
  if (!args.apply && (stats.missingEntries || stats.mismatchedEntries ||
      stats.orphanEntries || stats.missingProjectionItems ||
      stats.mismatchedProjectionItems || stats.orphanProjectionItems ||
      stats.oversizedProjectionDocuments ||
      stats.missingCompactProjectionDocuments ||
      stats.mismatchedCompactProjectionDocuments ||
      stats.orphanCompactProjectionDocuments ||
      stats.oversizedCompactProjectionDocuments)) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_ACK,
  MAX_PROJECTION_JSON_BYTES,
  listSourceDocuments,
  parseArgs,
  reconcileDocument,
  writeProjectionBackfill,
  writeCompactProjectionBackfill,
};
