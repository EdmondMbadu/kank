#!/usr/bin/env node
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {
  CONTROL_PATH,
  READ_PROJECTION_COLLECTION,
  compactLegacyFields,
  describeSourcePath,
  layouts,
  normalizeArchiveConfig,
  reconstructCompactLegacyFields,
  sha256,
  stableStringify,
} = require("../firestore-v2-core");

const COMPACT_ACK = "I_UNDERSTAND_THIS_COMPACTS_LEGACY_FIELDS";
const ROLLBACK_ACK = "I_UNDERSTAND_THIS_RESTORES_LEGACY_FIELDS";
const MAX_ROLLBACK_JSON_BYTES = 800 * 1024;

function parseArgs(argv) {
  const result = {
    project: "", action: "status", source: "", through: "", fields: [], ack: "",
    retentionMonths: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") result.project = argv[++index] || "";
    else if (arg === "--action") result.action = argv[++index] || "";
    else if (arg === "--source") result.source = argv[++index] || "";
    else if (arg === "--through") result.through = argv[++index] || "";
    else if (arg === "--fields") {
      result.fields = String(argv[++index] || "").split(",")
          .map((value) => value.trim()).filter(Boolean);
    } else if (arg === "--ack") result.ack = argv[++index] || "";
    else if (arg === "--retention-months") {
      result.retentionMonths = Number(argv[++index] || 0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function stripLegacyFields(sourcePath, data) {
  const descriptor = describeSourcePath(sourcePath);
  if (!descriptor) throw new Error(`Unsupported source path: ${sourcePath}`);
  const base = {...data};
  const layout = layouts[descriptor.kind];
  [...layout.mapFields, ...layout.arrayFields].forEach((field) => delete base[field]);
  return base;
}

function withoutMigrationMetadata(data) {
  const result = {...data};
  delete result._firestoreV2Archive;
  return result;
}

async function readLogicalState(sourceRef) {
  const [sourceSnapshot, projectionSnapshot] = await Promise.all([
    sourceRef.get(),
    sourceRef.collection(READ_PROJECTION_COLLECTION).get(),
  ]);
  if (!sourceSnapshot.exists) throw new Error(`Source does not exist: ${sourceRef.path}`);
  const sourceData = sourceSnapshot.data();
  const projectionDocuments = projectionSnapshot.docs.map((doc) => doc.data());
  if (!projectionDocuments.length) {
    throw new Error(`No compact projections exist below ${sourceRef.path}`);
  }
  const projectionOnly = reconstructCompactLegacyFields(
      sourceRef.path,
      projectionDocuments,
      stripLegacyFields(sourceRef.path, sourceData),
  );
  const logicalData = normalizeArchiveConfig(sourceRef.path, sourceData) ?
    reconstructCompactLegacyFields(
        sourceRef.path,
        projectionDocuments,
        sourceData,
    ) : sourceData;
  return {sourceSnapshot, sourceData, projectionDocuments, projectionOnly, logicalData};
}

function validateFields(sourcePath, fields) {
  const descriptor = describeSourcePath(sourcePath);
  if (!descriptor) throw new Error(`Unsupported source path: ${sourcePath}`);
  const allowed = new Set(layouts[descriptor.kind].mapFields);
  const invalid = fields.filter((field) => !allowed.has(field));
  if (!fields.length || invalid.length) {
    throw new Error(`--fields must contain supported map fields; invalid: ${invalid.join(", ")}`);
  }
  return descriptor;
}

async function compact(db, args) {
  if (args.ack !== COMPACT_ACK) {
    throw new Error(`Compact requires --ack ${COMPACT_ACK}`);
  }
  if (!/^\d{4}-\d{2}$/.test(args.through)) {
    throw new Error("Compact requires --through YYYY-MM.");
  }
  if (!Number.isInteger(args.retentionMonths) ||
      args.retentionMonths < 1 || args.retentionMonths > 60) {
    throw new Error("Compact requires --retention-months between 1 and 60.");
  }
  const descriptor = validateFields(args.source, args.fields);
  const controlRef = db.doc(CONTROL_PATH);
  const controlSnapshot = await controlRef.get();
  const control = controlSnapshot.exists ? controlSnapshot.data() : {};
  if (control.killSwitch === true || control.mirrorLegacyWrites !== true ||
      control.projectionWrites !== true || control.compactProjectionWrites !== true ||
      control.readFromV2 !== true || !Array.isArray(control.readKinds) ||
      !control.readKinds.includes(descriptor.kind)) {
    throw new Error("Compact requires all mirror/projection writers and v2 reads enabled for the source kind.");
  }

  const sourceRef = db.doc(args.source);
  const state = await readLogicalState(sourceRef);
  if (stableStringify(withoutMigrationMetadata(state.projectionOnly)) !==
      stableStringify(withoutMigrationMetadata(state.logicalData))) {
    throw new Error("Compact projection is not an exact independent reconstruction of the logical source.");
  }
  const archive = {through: args.through, fields: [...new Set(args.fields)].sort()};
  const compacted = compactLegacyFields(args.source, state.logicalData, archive);
  const beforeFingerprint = stableStringify(
      withoutMigrationMetadata(state.logicalData),
  );

  await controlRef.set({
    legacyCompactionEnabled: true,
    compactionSource: args.source,
    compactionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(sourceRef);
    if (!current.exists || stableStringify(current.data()) !== stableStringify(state.sourceData)) {
      throw new Error("Source changed after validation; rerun compact from a fresh snapshot.");
    }
    transaction.update(sourceRef, {
      ...compacted,
      _firestoreV2Archive: {
        ...archive,
        retentionMonths: args.retentionMonths,
        originalFingerprint: sha256(beforeFingerprint),
        compactedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  });

  const after = await readLogicalState(sourceRef);
  if (stableStringify(withoutMigrationMetadata(after.logicalData)) !==
      beforeFingerprint) {
    throw new Error("Post-compact logical verification failed; run rollback immediately.");
  }
  const latestControl = await controlRef.get();
  const previousSources = latestControl.exists &&
    Array.isArray(latestControl.get("compactionSources")) ?
    latestControl.get("compactionSources") : [];
  const compactionSource = {
    source: args.source,
    retentionMonths: args.retentionMonths,
    fields: archive.fields,
  };
  await controlRef.set({
    compactionSources: [
      ...previousSources.filter((source) => source && source.source !== args.source),
      compactionSource,
    ],
    compactionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return {
    action: "compact",
    source: args.source,
    through: args.through,
    fields: archive.fields,
    retentionMonths: args.retentionMonths,
    beforeJsonBytes: Buffer.byteLength(beforeFingerprint, "utf8"),
    afterSourceJsonBytes: Buffer.byteLength(stableStringify(after.sourceData), "utf8"),
    exactLogicalMatch: true,
    rollbackCommand: `node scripts/firestore-v2-cutover.js --project ${args.project} --action rollback --source ${args.source} --ack ${ROLLBACK_ACK}`,
  };
}

async function rollback(db, args) {
  if (args.ack !== ROLLBACK_ACK) {
    throw new Error(`Rollback requires --ack ${ROLLBACK_ACK}`);
  }
  const descriptor = describeSourcePath(args.source);
  if (!descriptor) throw new Error(`Unsupported source path: ${args.source}`);
  const controlRef = db.doc(CONTROL_PATH);
  const controlSnapshot = await controlRef.get();
  const compactionSources = controlSnapshot.exists &&
    Array.isArray(controlSnapshot.get("compactionSources")) ?
    controlSnapshot.get("compactionSources") : [];
  await controlRef.set({
    legacyCompactionEnabled: false,
    compactionSources: compactionSources.filter((source) =>
      source && source.source !== args.source),
    rollbackStartedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  const sourceRef = db.doc(args.source);
  const state = await readLogicalState(sourceRef);
  const serialized = stableStringify(state.logicalData);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > MAX_ROLLBACK_JSON_BYTES) {
    throw new Error(`Rollback source is ${bytes} JSON bytes, above the ${MAX_ROLLBACK_JSON_BYTES}-byte safety limit.`);
  }
  const layout = layouts[descriptor.kind];
  const restoredFields = {};
  [...layout.mapFields, ...layout.arrayFields].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(state.logicalData, field)) {
      restoredFields[field] = state.logicalData[field];
    }
  });

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(sourceRef);
    if (!current.exists || stableStringify(current.data()) !== stableStringify(state.sourceData)) {
      throw new Error("Source changed during rollback; rerun from a fresh snapshot.");
    }
    transaction.update(sourceRef, {
      ...restoredFields,
      _firestoreV2Archive: admin.firestore.FieldValue.delete(),
    });
  });

  const restored = await sourceRef.get();
  const restoredData = restored.data();
  for (const field of [...layout.mapFields, ...layout.arrayFields]) {
    if (stableStringify(restoredData[field]) !== stableStringify(state.logicalData[field])) {
      throw new Error(`Rollback verification failed for field ${field}; v2 reads remain enabled.`);
    }
  }
  await controlRef.set({
    readFromV2: false,
    readKinds: [],
    rollbackCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return {
    action: "rollback",
    source: args.source,
    restoredJsonBytes: bytes,
    exactLegacyMatch: true,
    readFromV2: false,
    legacyCompactionEnabled: false,
  };
}

async function verify(db, args) {
  const fields = Array.isArray(args.fields) ? args.fields : [];
  const sourceRef = db.doc(args.source);
  const state = await readLogicalState(sourceRef);
  const result = {
    action: "verify",
    source: args.source,
    archived: Boolean(normalizeArchiveConfig(args.source, state.sourceData)),
    sourceJsonBytes: Buffer.byteLength(stableStringify(state.sourceData), "utf8"),
    logicalJsonBytes: Buffer.byteLength(stableStringify(state.logicalData), "utf8"),
    projectionExact: stableStringify(withoutMigrationMetadata(state.projectionOnly)) ===
      stableStringify(withoutMigrationMetadata(state.logicalData)),
  };
  if (args.through || fields.length) {
    if (!/^\d{4}-\d{2}$/.test(args.through)) {
      throw new Error("Candidate verification requires --through YYYY-MM.");
    }
    validateFields(args.source, fields);
    const archive = {through: args.through, fields};
    const candidate = {
      ...state.sourceData,
      ...compactLegacyFields(args.source, state.logicalData, archive),
      _firestoreV2Archive: archive,
    };
    result.candidate = {
      through: args.through,
      fields,
      sourceJsonBytesAfter: Buffer.byteLength(stableStringify(candidate), "utf8"),
      sourceJsonBytesSaved: result.sourceJsonBytes -
        Buffer.byteLength(stableStringify(candidate), "utf8"),
    };
  }
  return result;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.project) throw new Error("--project is required.");
  if (!["status", "verify", "compact", "rollback"].includes(args.action)) {
    throw new Error("--action must be status, verify, compact, or rollback.");
  }
  if (args.action !== "status" && !args.source) throw new Error("--source is required.");
  admin.initializeApp({projectId: args.project});
  const db = admin.firestore();
  let result;
  if (args.action === "compact") result = await compact(db, args);
  else if (args.action === "rollback") result = await rollback(db, args);
  else if (args.action === "verify") result = await verify(db, args);
  else {
    const snapshot = await db.doc(CONTROL_PATH).get();
    result = snapshot.exists ? snapshot.data() : {exists: false};
  }
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {
  COMPACT_ACK,
  MAX_ROLLBACK_JSON_BYTES,
  ROLLBACK_ACK,
  compact,
  parseArgs,
  readLogicalState,
  rollback,
  stripLegacyFields,
  validateFields,
  verify,
  withoutMigrationMetadata,
};
