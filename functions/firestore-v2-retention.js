/* eslint-disable max-len */
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
  stableStringify,
} = require("./firestore-v2-core");

function retentionCutoff(now, retentionMonths) {
  const date = now instanceof Date ? now : new Date(now);
  const months = Number(retentionMonths);
  if (Number.isNaN(date.getTime()) || !Number.isInteger(months) || months < 1) {
    throw new Error("A valid date and a positive integer retentionMonths are required.");
  }
  const cutoff = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() - months,
      1,
  ));
  return `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeRetentionSource(raw) {
  if (!raw || typeof raw !== "object") return null;
  const source = String(raw.source || "").trim();
  const descriptor = describeSourcePath(source);
  const retentionMonths = Number(raw.retentionMonths);
  if (!descriptor || !Number.isInteger(retentionMonths) ||
      retentionMonths < 1 || retentionMonths > 60) return null;
  const allowed = new Set(layouts[descriptor.kind].mapFields);
  const fields = Array.isArray(raw.fields) ?
    [...new Set(raw.fields.map(String).filter((field) => allowed.has(field)))].sort() : [];
  if (!fields.length) return null;
  return {source, kind: descriptor.kind, retentionMonths, fields};
}

function stripLayoutFields(sourcePath, data) {
  const descriptor = describeSourcePath(sourcePath);
  if (!descriptor) throw new Error(`Unsupported source path: ${sourcePath}`);
  const result = {...data};
  const layout = layouts[descriptor.kind];
  [...layout.mapFields, ...layout.arrayFields].forEach((field) => delete result[field]);
  return result;
}

function withoutMigrationMetadata(data) {
  const result = {...data};
  delete result._firestoreV2Archive;
  return result;
}

async function compactConfiguredSource(db, config, now) {
  const sourceRef = db.doc(config.source);
  const [sourceSnapshot, projectionSnapshot] = await Promise.all([
    sourceRef.get(),
    sourceRef.collection(READ_PROJECTION_COLLECTION).get(),
  ]);
  if (!sourceSnapshot.exists) throw new Error(`Source does not exist: ${config.source}`);
  if (!projectionSnapshot.docs.length) {
    throw new Error(`No compact projections exist below ${config.source}`);
  }
  const sourceData = sourceSnapshot.data() || {};
  const projectionDocuments = projectionSnapshot.docs.map((doc) => doc.data());
  const projectionOnly = reconstructCompactLegacyFields(
      config.source,
      projectionDocuments,
      stripLayoutFields(config.source, sourceData),
  );
  const currentArchive = normalizeArchiveConfig(config.source, sourceData);
  const logicalData = currentArchive ? reconstructCompactLegacyFields(
      config.source,
      projectionDocuments,
      sourceData,
  ) : sourceData;
  if (stableStringify(withoutMigrationMetadata(projectionOnly)) !==
      stableStringify(withoutMigrationMetadata(logicalData))) {
    throw new Error(`Compact projections do not exactly reconstruct ${config.source}`);
  }

  const calculatedThrough = retentionCutoff(now, config.retentionMonths);
  const through = currentArchive && currentArchive.through > calculatedThrough ?
    currentArchive.through : calculatedThrough;
  // Never silently unarchive a previously compacted field. Restoring fields
  // belongs exclusively to the verified rollback command.
  const fields = [...new Set([
    ...config.fields,
    ...(currentArchive ? currentArchive.fields : []),
  ])].sort();
  const archive = {through, fields};
  const compacted = compactLegacyFields(config.source, logicalData, archive);
  const expectedLogical = stableStringify(withoutMigrationMetadata(logicalData));
  const sourceAlreadyBounded = currentArchive &&
    currentArchive.through === through &&
    stableStringify([...currentArchive.fields].sort()) === stableStringify(fields) &&
    Object.entries(compacted).every(([field, value]) =>
      stableStringify(sourceData[field] || {}) === stableStringify(value));
  if (sourceAlreadyBounded) {
    return {
      source: config.source,
      through,
      retentionMonths: config.retentionMonths,
      fields,
      exactLogicalMatch: true,
      changed: false,
      sourceJsonBytes: Buffer.byteLength(stableStringify(sourceData), "utf8"),
    };
  }
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(sourceRef);
    if (!current.exists ||
        stableStringify(current.data()) !== stableStringify(sourceData)) {
      throw new Error(`Source changed while compacting ${config.source}`);
    }
    transaction.update(sourceRef, {
      ...compacted,
      _firestoreV2Archive: {
        ...archive,
        retentionMonths: config.retentionMonths,
        lastCompactedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  });

  const afterSnapshot = await sourceRef.get();
  const afterData = afterSnapshot.data() || {};
  const afterLogical = reconstructCompactLegacyFields(
      config.source,
      projectionDocuments,
      afterData,
  );
  if (stableStringify(withoutMigrationMetadata(afterLogical)) !== expectedLogical) {
    throw new Error(`Post-compaction logical verification failed for ${config.source}`);
  }
  return {
    source: config.source,
    through,
    retentionMonths: config.retentionMonths,
    fields,
    exactLogicalMatch: true,
    changed: true,
    sourceJsonBytes: Buffer.byteLength(stableStringify(afterData), "utf8"),
  };
}

async function runRetentionCycle(db, now = new Date()) {
  const controlSnapshot = await db.doc(CONTROL_PATH).get();
  const control = controlSnapshot.exists ? controlSnapshot.data() : {};
  if (control.killSwitch === true || control.legacyCompactionEnabled !== true ||
      control.mirrorLegacyWrites !== true ||
      control.compactProjectionWrites !== true || control.readFromV2 !== true) {
    return {skipped: true, reason: "retention-controls-disabled", results: []};
  }
  const sources = Array.isArray(control.compactionSources) ?
    control.compactionSources.map(normalizeRetentionSource).filter(Boolean) : [];
  const enabledKinds = new Set(Array.isArray(control.readKinds) ? control.readKinds : []);
  const results = [];
  for (const source of sources) {
    if (!enabledKinds.has(source.kind)) {
      throw new Error(`V2 reads are not enabled for retention source kind ${source.kind}`);
    }
    results.push(await compactConfiguredSource(db, source, now));
  }
  return {skipped: false, results};
}

module.exports = {
  compactConfiguredSource,
  normalizeRetentionSource,
  retentionCutoff,
  runRetentionCycle,
  stripLayoutFields,
  withoutMigrationMetadata,
};
