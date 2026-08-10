#!/usr/bin/env node
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {
  CONTROL_PATH,
  ENTRY_COLLECTION,
  materializeEntries,
} = require("../firestore-v2-core");

const APPLY_ACK = "I_UNDERSTAND_THIS_ADDS_V2_DOCUMENTS";
const RECONCILE_CONCURRENCY = 20;

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

async function reconcileDocument(doc, apply, bulkWriter, stats) {
  const expected = materializeEntries(doc.ref.path, doc.data());
  stats.sourceDocuments += 1;
  stats.expectedEntries += expected.length;

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
  if (args.apply && (control.killSwitch === true || control.mirrorLegacyWrites !== true)) {
    throw new Error("Apply mode requires mirrorLegacyWrites=true and killSwitch=false to prevent a moving-data gap.");
  }

  const stats = {
    mode: args.apply ? "apply" : "dry-run",
    project: args.project,
    sourceDocuments: 0,
    expectedEntries: 0,
    matchingEntries: 0,
    missingEntries: 0,
    mismatchedEntries: 0,
    orphanEntries: 0,
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
  if (!args.apply && (stats.missingEntries || stats.mismatchedEntries || stats.orphanEntries)) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {APPLY_ACK, listSourceDocuments, parseArgs, reconcileDocument};
