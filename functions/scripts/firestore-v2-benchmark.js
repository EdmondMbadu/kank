#!/usr/bin/env node
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {
  ENTRY_COLLECTION,
  PROJECTION_COLLECTION,
  READ_PROJECTION_COLLECTION,
  describeSourcePath,
  flattenLatestProjectionItems,
  layouts,
  reconstructLegacyFields,
  reconstructCompactLegacyFields,
  stableStringify,
} = require("../firestore-v2-core");

function parseArgs(argv) {
  const result = {
    project: "", source: "", month: "", iterations: 5,
    fields: ["reserve", "moneyInHandsActivities"],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") result.project = argv[++index] || "";
    else if (arg === "--source") result.source = argv[++index] || "";
    else if (arg === "--month") result.month = argv[++index] || "";
    else if (arg === "--iterations") result.iterations = Number(argv[++index] || 5);
    else if (arg === "--fields") {
      result.fields = String(argv[++index] || "").split(",")
          .map((value) => value.trim()).filter(Boolean);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function measure(iterations, callback) {
  await callback();
  const durations = [];
  let lastResult;
  for (let index = 0; index < iterations; index += 1) {
    const start = process.hrtime.bigint();
    lastResult = await callback();
    durations.push(Number(process.hrtime.bigint() - start) / 1000000);
  }
  return {
    iterations,
    minMs: Math.min(...durations),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
    lastResult,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.project || !args.source || !/^\d{4}-\d{2}$/.test(args.month)) {
    throw new Error("--project, --source, and --month YYYY-MM are required.");
  }
  if (!Number.isInteger(args.iterations) || args.iterations < 1 || args.iterations > 20) {
    throw new Error("--iterations must be an integer between 1 and 20.");
  }

  admin.initializeApp({projectId: args.project});
  const db = admin.firestore();
  const sourceRef = db.doc(args.source);
  const legacy = await measure(args.iterations, async () => {
    const snapshot = await sourceRef.get();
    return {
      exists: snapshot.exists,
      bytes: snapshot.exists ? Buffer.byteLength(stableStringify(snapshot.data()), "utf8") : 0,
    };
  });

  const compatibleProjection = await measure(args.iterations, async () => {
    const [sourceSnapshot, projectionSnapshot] = await Promise.all([
      sourceRef.get(),
      sourceRef.collection(PROJECTION_COLLECTION).get(),
    ]);
    if (!sourceSnapshot.exists) return {exists: false};
    const sourceData = sourceSnapshot.data();
    const descriptor = describeSourcePath(args.source);
    const baseData = {...sourceData};
    if (descriptor) {
      const layout = layouts[descriptor.kind];
      [...layout.mapFields, ...layout.arrayFields].forEach((field) => {
        delete baseData[field];
      });
    }
    const entries = flattenLatestProjectionItems(
        args.source,
        projectionSnapshot.docs.map((doc) => doc.data()),
    );
    const reconstructed = reconstructLegacyFields(
        args.source,
        entries,
        baseData,
    );
    return {
      exists: true,
      projectionDocuments: projectionSnapshot.size,
      projectionItems: entries.length,
      exactLegacyMatch: stableStringify(reconstructed) === stableStringify(sourceData),
      bytes: Buffer.byteLength(stableStringify(reconstructed), "utf8"),
    };
  });

  const compactProjection = await measure(args.iterations, async () => {
    const [sourceSnapshot, projectionSnapshot] = await Promise.all([
      sourceRef.get(),
      sourceRef.collection(READ_PROJECTION_COLLECTION).get(),
    ]);
    if (!sourceSnapshot.exists) return {exists: false};
    const sourceData = sourceSnapshot.data();
    const descriptor = describeSourcePath(args.source);
    const baseData = {...sourceData};
    if (descriptor) {
      const layout = layouts[descriptor.kind];
      [...layout.mapFields, ...layout.arrayFields].forEach((field) => {
        delete baseData[field];
      });
    }
    const reconstructed = reconstructCompactLegacyFields(
        args.source,
        projectionSnapshot.docs.map((doc) => doc.data()),
        baseData,
    );
    return {
      exists: true,
      projectionDocuments: projectionSnapshot.size,
      exactLegacyMatch: stableStringify(reconstructed) === stableStringify(sourceData),
      bytes: Buffer.byteLength(stableStringify(reconstructed), "utf8"),
    };
  });

  const v2 = {};
  for (const field of args.fields) {
    v2[field] = await measure(args.iterations, async () => {
      const snapshot = await sourceRef.collection(ENTRY_COLLECTION)
          .where("field", "==", field)
          .where("monthKey", "==", args.month)
          .orderBy("legacyKey", "asc")
          .get();
      return {
        documents: snapshot.size,
        payloadBytes: snapshot.docs.reduce((total, doc) =>
          total + Number(doc.get("payloadBytes") || 0), 0),
      };
    });
  }
  console.log(JSON.stringify({
    project: args.project,
    source: args.source,
    month: args.month,
    legacy,
    compatibleProjection,
    compactProjection,
    v2,
    note: "Warm-cache Admin SDK measurements; v2 queries read only the selected field/month.",
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {measure, parseArgs, percentile};
