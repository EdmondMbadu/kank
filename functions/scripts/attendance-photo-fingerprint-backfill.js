#!/usr/bin/env node
/* eslint-disable require-jsdoc */

const admin = require("firebase-admin");
const {
  commitBackfilledFingerprint,
  verifyAttendancePhotoForSite,
} = require("../attendance-photo-verification");

const MAX_HISTORICAL_PHOTO_BYTES = 20 * 1024 * 1024;

function argumentValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function dateISOFromLegacyLabel(label) {
  const parts = String(label || "").split("-").map(Number);
  if (parts.length < 3) return "";
  const [month, day, year] = parts;
  const dateISO = `${String(year).padStart(4, "0")}-` +
    `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dateISO ? "" : dateISO;
}

function addProof(proofsByPath, employeeId, dateISO, attachment) {
  const storagePath = String((attachment && attachment.path) || "").trim();
  if (!storagePath || !dateISO) return;
  proofsByPath.set(storagePath, {employeeId, dateISO, storagePath});
}

async function listAttendanceProofs(db, siteId, cutoffISO) {
  const employeesSnapshot = await db
      .collection("users")
      .doc(siteId)
      .collection("employees")
      .select("attendanceAttachments")
      .get();
  const proofsByPath = new Map();
  for (const employeeDocument of employeesSnapshot.docs) {
    const employee = employeeDocument.data() || {};
    const legacyAttachments = employee.attendanceAttachments || {};
    for (const [dateLabel, attachment] of Object.entries(legacyAttachments)) {
      const dateISO = dateISOFromLegacyLabel(dateLabel);
      if (dateISO >= cutoffISO) {
        addProof(proofsByPath, employeeDocument.id, dateISO, attachment);
      }
    }

    const attendanceSnapshot = await employeeDocument.ref
        .collection("attendance")
        .where(admin.firestore.FieldPath.documentId(), ">=", cutoffISO)
        .get();
    for (const attendanceDocument of attendanceSnapshot.docs) {
      const attendance = attendanceDocument.data();
      const dateISO = attendanceDocument.id;
      const proof = attendance.proof;
      addProof(proofsByPath, employeeDocument.id, dateISO, proof);

      // Older records can have attachment documents without the denormalized
      // `proof` field. This query runs only for those legacy days.
      if (!(proof && proof.path)) {
        const attachmentSnapshot = await attendanceDocument.ref
            .collection("attachments")
            .get();
        for (const attachmentDocument of attachmentSnapshot.docs) {
          addProof(
              proofsByPath,
              employeeDocument.id,
              dateISO,
              attachmentDocument.data(),
          );
        }
      }
    }
  }
  return [...proofsByPath.values()].sort((left, right) =>
    left.dateISO.localeCompare(right.dateISO),
  );
}

async function main() {
  const siteId = argumentValue("site").trim();
  const projectId = argumentValue("project").trim() ||
    process.env.GCLOUD_PROJECT;
  const days = Math.max(1, Math.min(92, Number(argumentValue("days")) || 31));
  const concurrency = Math.max(
      1,
      Math.min(8, Number(argumentValue("concurrency")) || 4),
  );
  const apply = process.argv.includes("--apply");
  if (!siteId || siteId.includes("/")) {
    throw new Error("Pass one site with --site SITE_ID.");
  }
  if (!projectId) {
    throw new Error("Pass the Firebase project with --project PROJECT_ID.");
  }

  admin.initializeApp({
    projectId,
    storageBucket: `${projectId}.appspot.com`,
  });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const cutoffISO = isoDaysAgo(days);
  const proofs = await listAttendanceProofs(db, siteId, cutoffISO);
  console.info("Attendance photo backfill inventory", {
    siteId,
    cutoffISO,
    proofCount: proofs.length,
    apply,
    concurrency,
  });
  if (!apply) {
    console.info("Dry run only. Add --apply to generate fingerprints.");
    return;
  }

  let completed = 0;
  let failed = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < proofs.length) {
      const proof = proofs[cursor];
      cursor += 1;
      try {
        const verification = await verifyAttendancePhotoForSite({
          bucket,
          db,
          siteId,
          employeeId: proof.employeeId,
          dateISO: proof.dateISO,
          storagePath: proof.storagePath,
          // Historical uploads predate the current client-side compression.
          // Keep the live callable at 2 MB while allowing this bounded,
          // operator-only migration to fingerprint older originals.
          maxPhotoBytes: MAX_HISTORICAL_PHOTO_BYTES,
          // Employee/site transfers can preserve a valid immutable proof URL
          // whose Storage path still contains its original owner. This flag
          // is never supplied by the public callable.
          allowHistoricalStoragePath: true,
        });
        await commitBackfilledFingerprint({
          db,
          siteId,
          verificationId: verification.verificationId,
        });
        completed += 1;
      } catch (error) {
        failed += 1;
        console.warn("Attendance proof backfill skipped", {
          employeeId: proof.employeeId,
          dateISO: proof.dateISO,
          storagePath: proof.storagePath,
          error: String((error && error.message) || error).slice(0, 500),
        });
      }
    }
  }
  await Promise.all(
      Array.from(
          {length: Math.min(concurrency, proofs.length)},
          () => worker(),
      ),
  );
  console.info("Attendance photo backfill completed", {
    siteId,
    proofCount: proofs.length,
    completed,
    failed,
  });
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {dateISOFromLegacyLabel, listAttendanceProofs};
