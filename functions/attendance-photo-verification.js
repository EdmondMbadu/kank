/* eslint-disable require-jsdoc */
const {randomUUID} = require("crypto");
const {
  ATTENDANCE_PHOTO_ALGORITHM_VERSION,
  ATTENDANCE_PHOTO_HISTORY_DAYS,
  ATTENDANCE_PHOTO_MAX_CANDIDATES,
  ATTENDANCE_PHOTO_RETENTION_DAYS,
  compareFingerprints,
  createAttendancePhotoFingerprint,
  firestoreArrayAnyBatches,
  publicVerificationResult,
  sha256Hex,
} = require("./attendance-photo-similarity");

const MAX_ATTENDANCE_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_BACKFILL_PHOTO_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTENDANCE_STATES = new Set(["P", "A", "L", "N", "F"]);

function requiredId(value, field) {
  const id = String(value || "").trim();
  if (!id || id.length > 200 || id.includes("/")) {
    throw new Error(`${field} is invalid.`);
  }
  return id;
}

function requiredDateISO(value) {
  const dateISO = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    throw new Error("dateISO is invalid.");
  }
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dateISO
  ) {
    throw new Error("dateISO is invalid.");
  }
  return dateISO;
}

function expectedDateLabelPrefix(dateISO) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return `${month}-${day}-${year}`;
}

function requiredDateLabel(value, dateISO) {
  const label = String(value || "").trim();
  const prefix = expectedDateLabelPrefix(dateISO);
  if (
    !label ||
    label.length > 80 ||
    !/^[0-9-]+$/.test(label) ||
    (label !== prefix && !label.startsWith(`${prefix}-`))
  ) {
    throw new Error("dateLabel is invalid.");
  }
  return label;
}

function requiredAttendancePath(siteId, employeeId, dateISO, value) {
  const storagePath = String(value || "").trim();
  const prefix = `attendance_proofs/${siteId}/${employeeId}/${dateISO}/`;
  if (
    !storagePath.startsWith(prefix) ||
    storagePath.length > 1024 ||
    storagePath === prefix ||
    storagePath.includes("..")
  ) {
    throw new Error("The attendance photo path is invalid.");
  }
  return storagePath;
}

function requiredHistoricalAttendancePath(dateISO, value) {
  const storagePath = String(value || "").trim();
  const parts = storagePath.split("/");
  if (
    parts.length !== 5 ||
    parts[0] !== "attendance_proofs" ||
    !parts[1] ||
    !parts[2] ||
    parts[3] !== dateISO ||
    !parts[4] ||
    storagePath.length > 1024 ||
    storagePath.includes("..")
  ) {
    throw new Error("The historical attendance photo path is invalid.");
  }
  return storagePath;
}

function verificationIdFor(storagePath, generation) {
  return sha256Hex(Buffer.from(`${storagePath}#${generation}`)).slice(0, 48);
}

function downloadUrlFor(bucketName, storagePath, token) {
  return "https://firebasestorage.googleapis.com/v0/b/" +
    `${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}` +
    `?alt=media&token=${encodeURIComponent(token)}`;
}

async function ensureDownloadUrl(file, bucketName, storagePath, metadata) {
  let currentMetadata = metadata;
  const customMetadata = currentMetadata.metadata || {};
  let token = String(customMetadata.firebaseStorageDownloadTokens || "")
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
  if (!token) {
    token = randomUUID();
    [currentMetadata] = await file.setMetadata({
      metadata: {
        ...customMetadata,
        firebaseStorageDownloadTokens: token,
      },
    });
  }
  return {
    downloadURL: downloadUrlFor(bucketName, storagePath, token),
    metadata: currentMetadata,
  };
}

function recordFingerprint(record) {
  return {
    algorithmVersion: record.algorithmVersion,
    byteSha256: record.byteSha256,
    pHash64: record.pHash64,
    dHash64: record.dHash64,
    bandKeys: record.bandKeys,
    luma64Base64: record.luma64Base64,
  };
}

function candidateRank(comparison) {
  return comparison.pHashDistance * 4 +
    comparison.dHashDistance * 2 +
    comparison.meanAbsoluteDifference;
}

async function findBestCandidate(
    fingerprints,
    current,
    cutoffMs,
    getSnapshot = (query) => query.get(),
) {
  const snapshots = await Promise.all(
      firestoreArrayAnyBatches(current.bandKeys).map((bandKeys) =>
        getSnapshot(
            fingerprints
                .where("committed", "==", true)
                .where("bandKeys", "array-contains-any", bandKeys)
                .where("serverUploadedAtMs", ">=", cutoffMs)
                .limit(ATTENDANCE_PHOTO_MAX_CANDIDATES),
        ),
      ),
  );

  let bestDuplicate = null;
  let bestPossibleReuse = null;
  const documents = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      documents.set(document.id, document);
    }
  }
  for (const document of documents.values()) {
    const candidate = document.data();
    if (
      candidate.storagePath === current.storagePath ||
      candidate.algorithmVersion !== ATTENDANCE_PHOTO_ALGORITHM_VERSION
    ) {
      continue;
    }
    const comparison = compareFingerprints(current, candidate);
    const result = {
      candidate,
      comparison,
      rank: candidateRank(comparison),
    };
    if (
      comparison.duplicate &&
      (!bestDuplicate || result.rank < bestDuplicate.rank)
    ) {
      bestDuplicate = result;
    }
    if (
      comparison.possibleReuse &&
      (!bestPossibleReuse || result.rank < bestPossibleReuse.rank)
    ) {
      bestPossibleReuse = result;
    }
  }
  return {bestDuplicate, bestPossibleReuse};
}

async function verifyAttendancePhotoForSite(options) {
  const {
    bucket,
    db,
    siteId: rawSiteId,
    employeeId: rawEmployeeId,
    dateISO: rawDateISO,
    storagePath: rawStoragePath,
  } = options;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maximumPhotoBytes = Number.isFinite(options.maxPhotoBytes) ?
    Math.max(
        MAX_ATTENDANCE_PHOTO_BYTES,
        Math.min(MAX_BACKFILL_PHOTO_BYTES, options.maxPhotoBytes),
    ) : MAX_ATTENDANCE_PHOTO_BYTES;
  const siteId = requiredId(rawSiteId, "siteId");
  const employeeId = requiredId(rawEmployeeId, "employeeId");
  const dateISO = requiredDateISO(rawDateISO);
  const storagePath = options.allowHistoricalStoragePath ?
    requiredHistoricalAttendancePath(dateISO, rawStoragePath) :
    requiredAttendancePath(siteId, employeeId, dateISO, rawStoragePath);

  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("The attendance photo does not exist.");
  }

  let [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || "").toLowerCase();
  const size = Number(metadata.size || 0);
  if (!contentType.startsWith("image/")) {
    throw new Error("Attendance proof must be an image.");
  }
  if (!Number.isFinite(size) || size < 1 || size > maximumPhotoBytes) {
    throw new Error("The prepared attendance photo is too large.");
  }

  const generation = String(metadata.generation || "0");
  const verificationId = verificationIdFor(storagePath, generation);
  const siteRef = db.collection("users").doc(siteId);
  const fingerprints = siteRef.collection("attendancePhotoFingerprints");
  const verificationRef = fingerprints.doc(verificationId);
  const existing = await verificationRef.get();
  if (existing.exists) return publicVerificationResult(existing.data());

  const [downloaded] = await file.download();
  const fingerprint = await createAttendancePhotoFingerprint(downloaded);
  const uploadedAtMs = metadata.timeCreated ?
    new Date(metadata.timeCreated).getTime() : nowMs;
  const urlResult = await ensureDownloadUrl(
      file,
      bucket.name,
      storagePath,
      metadata,
  );
  metadata = urlResult.metadata;

  const exactRef = siteRef
      .collection("attendancePhotoExactHashes")
      .doc(fingerprint.byteSha256);
  const exactSnapshot = await exactRef.get();
  const exactRecord = exactSnapshot.exists ? exactSnapshot.data() : null;
  let match = null;
  let reason = "unique";
  let possibleReuse = false;
  let possibleMatch = null;

  if (exactRecord && exactRecord.storagePath !== storagePath) {
    match = {
      candidate: exactRecord,
      comparison: {
        exactBytes: true,
        pHashDistance: 0,
        dHashDistance: 0,
        correlation: 1,
        meanAbsoluteDifference: 0,
        brightnessAdjustedDifference: 0,
      },
    };
    reason = "exact_hash";
  } else {
    const cutoffMs = nowMs - ATTENDANCE_PHOTO_HISTORY_DAYS * 86400000;
    const candidateResult = await findBestCandidate(
        fingerprints,
        {...fingerprint, storagePath},
        cutoffMs,
    );
    match = candidateResult.bestDuplicate;
    possibleMatch = candidateResult.bestPossibleReuse;
    if (match) {
      reason = match.comparison.exactBytes ?
        "exact_hash" : "near_exact_visual";
    }
    possibleReuse = Boolean(!match && possibleMatch);
  }

  const matched = match ? match.candidate : null;
  const comparison = match ? match.comparison :
    possibleMatch ? possibleMatch.comparison : null;
  const record = {
    verificationId,
    verificationState: "ready",
    verdict: match ? "duplicate" : "clear",
    reason,
    possibleReuse,
    algorithmVersion: ATTENDANCE_PHOTO_ALGORITHM_VERSION,
    siteId,
    employeeId,
    attendanceDateISO: dateISO,
    storagePath,
    storageGeneration: generation,
    contentType,
    size,
    downloadURL: urlResult.downloadURL,
    serverUploadedAtMs: Number.isFinite(uploadedAtMs) ? uploadedAtMs : nowMs,
    checkedAtMs: nowMs,
    expiresAt: new Date(
        (Number.isFinite(uploadedAtMs) ? uploadedAtMs : nowMs) +
        ATTENDANCE_PHOTO_RETENTION_DAYS * 86400000,
    ),
    committed: false,
    ...fingerprint,
    matchedProofId: matched ? matched.proofId || matched.verificationId : null,
    matchedDateISO: matched ? matched.attendanceDateISO || null : null,
    matchedEmployeeId: matched ? matched.employeeId || null : null,
    matchedStoragePath: matched ? matched.storagePath || null : null,
    possibleMatchedProofId: possibleMatch ?
      possibleMatch.candidate.proofId || null : null,
    pHashDistance: comparison ? comparison.pHashDistance : null,
    dHashDistance: comparison ? comparison.dHashDistance : null,
    pixelCorrelation: comparison ? comparison.correlation : null,
    pixelMeanAbsoluteDifference: comparison ?
      comparison.meanAbsoluteDifference : null,
    pixelBrightnessAdjustedDifference: comparison ?
      comparison.brightnessAdjustedDifference : null,
  };
  await verificationRef.set(record, {merge: false});
  return publicVerificationResult(record);
}

function shortString(value, maximum) {
  return String(value || "").trim().slice(0, maximum);
}

function sanitizeAuditMetadata(value) {
  const audit = value && typeof value === "object" ? value : {};
  const takenAt = Number(audit.takenAt);
  const photoHash = /^[a-f0-9]{64}$/i.test(String(audit.photoHash || "")) ?
    String(audit.photoHash).toLowerCase() : null;
  const device = audit.device && typeof audit.device === "object" ? {
    make: shortString(audit.device.make, 80) || null,
    model: shortString(audit.device.model, 80) || null,
    software: shortString(audit.device.software, 120) || null,
    imageUniqueId: shortString(audit.device.imageUniqueId, 160) || null,
    serial: shortString(audit.device.serial, 120) || null,
    lens: shortString(audit.device.lens, 120) || null,
  } : null;
  const ua = audit.ua && typeof audit.ua === "object" ? {
    mobile: typeof audit.ua.mobile === "boolean" ? audit.ua.mobile : null,
    platform: shortString(audit.ua.platform, 80) || null,
    language: shortString(audit.ua.language, 40) || null,
    ua: shortString(audit.ua.ua, 400) || null,
  } : null;

  return {
    ...(Number.isFinite(takenAt) ? {takenAt} : {}),
    takenAtSource: shortString(audit.takenAtSource, 40) || "unknown",
    device,
    ua,
    softDeviceId: shortString(audit.softDeviceId, 120) || null,
    photoHash,
  };
}

async function finalizeVerifiedAttendance(options) {
  const {
    db,
    siteId: rawSiteId,
    employeeId: rawEmployeeId,
    dateISO: rawDateISO,
    dateLabel: rawDateLabel,
    requestedStatus: rawRequestedStatus,
    verificationId: rawVerificationId,
  } = options;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const siteId = requiredId(rawSiteId, "siteId");
  const employeeId = requiredId(rawEmployeeId, "employeeId");
  const dateISO = requiredDateISO(rawDateISO);
  const dateLabel = requiredDateLabel(rawDateLabel, dateISO);
  const requestedStatus = String(rawRequestedStatus || "");
  if (!ALLOWED_ATTENDANCE_STATES.has(requestedStatus)) {
    throw new Error("The attendance status is invalid.");
  }
  const verificationId = requiredId(rawVerificationId, "verificationId");
  const siteRef = db.collection("users").doc(siteId);
  const fingerprints = siteRef.collection("attendancePhotoFingerprints");
  const verificationRef = fingerprints.doc(verificationId);
  const initialVerification = await verificationRef.get();
  if (!initialVerification.exists) {
    throw new Error("The attendance photo has not been verified.");
  }
  const initialRecord = initialVerification.data();
  if (
    initialRecord.siteId !== siteId ||
    initialRecord.employeeId !== employeeId ||
    initialRecord.attendanceDateISO !== dateISO ||
    initialRecord.verificationState !== "ready"
  ) {
    throw new Error("The attendance photo verification does not match.");
  }

  const exactRef = siteRef
      .collection("attendancePhotoExactHashes")
      .doc(initialRecord.byteSha256);
  const employeeRef = siteRef.collection("employees").doc(employeeId);
  const dayRef = employeeRef.collection("attendance").doc(dateISO);
  const storageName = initialRecord.storagePath.split("/").pop() ||
    verificationId;
  const attachmentId = storageName
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 500);
  const attachmentRef = dayRef.collection("attachments").doc(attachmentId);
  const audit = sanitizeAuditMetadata(options.auditMetadata);
  let response = null;

  await db.runTransaction(async (transaction) => {
    const [verificationSnapshot, exactSnapshot] = await Promise.all([
      transaction.get(verificationRef),
      transaction.get(exactRef),
    ]);
    if (!verificationSnapshot.exists) {
      throw new Error("The attendance photo verification expired.");
    }
    const verification = verificationSnapshot.data();
    let verdict = verification.verdict;
    let reason = verification.reason;
    let matchedDateISO = verification.matchedDateISO || null;
    let matchedEmployeeId = verification.matchedEmployeeId || null;
    if (
      exactSnapshot.exists &&
      exactSnapshot.data().storagePath !== verification.storagePath
    ) {
      verdict = "duplicate";
      reason = "exact_hash";
      matchedDateISO = exactSnapshot.data().attendanceDateISO || null;
      matchedEmployeeId = exactSnapshot.data().employeeId || null;
    } else if (verdict !== "duplicate") {
      // Re-run the selective visual query inside the transaction. This makes
      // two different encodings submitted at nearly the same time conflict
      // and retry instead of both being accepted from stale pre-checks.
      const cutoffMs = nowMs - ATTENDANCE_PHOTO_HISTORY_DAYS * 86400000;
      const candidateResult = await findBestCandidate(
          fingerprints,
          {...recordFingerprint(verification),
            storagePath: verification.storagePath},
          cutoffMs,
          (query) => transaction.get(query),
      );
      if (candidateResult.bestDuplicate) {
        const match = candidateResult.bestDuplicate;
        verdict = "duplicate";
        reason = match.comparison.exactBytes ?
          "exact_hash" : "near_exact_visual";
        matchedDateISO = match.candidate.attendanceDateISO || null;
        matchedEmployeeId = match.candidate.employeeId || null;
      }
    }
    const finalStatus = verdict === "duplicate" ? "F" : requestedStatus;
    const proofVerification = {
      verificationId,
      verdict,
      reason,
      possibleReuse: Boolean(verification.possibleReuse),
      algorithmVersion: verification.algorithmVersion,
      matchedDateISO,
      matchedEmployeeId,
      checkedAtMs: verification.checkedAtMs,
    };
    const attachment = {
      url: verification.downloadURL,
      path: verification.storagePath,
      size: verification.size,
      contentType: verification.contentType,
      uploadedAt: verification.serverUploadedAtMs,
      uploaderId: siteId,
      ...audit,
      photoVerification: proofVerification,
    };
    const fingerprint = {
      proofId: verificationId,
      siteId,
      employeeId,
      attendanceDateISO: dateISO,
      storagePath: verification.storagePath,
      storageGeneration: verification.storageGeneration,
      serverUploadedAtMs: verification.serverUploadedAtMs,
      committedAtMs: nowMs,
      committed: true,
      verdict,
      reason,
      possibleReuse: Boolean(verification.possibleReuse),
      matchedDateISO,
      matchedEmployeeId,
      ...recordFingerprint(verification),
    };

    transaction.set(employeeRef, {
      attendance: {[dateLabel]: finalStatus},
      attendanceAttachments: {[dateLabel]: attachment},
    }, {merge: true});
    transaction.set(dayRef, {
      status: finalStatus,
      dateISO,
      dateLabel,
      createdAt: new Date(nowMs),
      createdBy: siteId,
      proofState: "ready",
      attachmentId,
      proof: attachment,
      photoVerification: proofVerification,
    }, {merge: true});
    transaction.set(attachmentRef, attachment, {merge: true});
    transaction.set(verificationRef, {
      ...fingerprint,
      committed: true,
      committedAtMs: nowMs,
      finalStatus,
      verdict,
      reason,
      matchedDateISO,
      matchedEmployeeId,
    }, {merge: true});
    if (!exactSnapshot.exists) {
      transaction.set(exactRef, {
        proofId: verificationId,
        siteId,
        employeeId,
        attendanceDateISO: dateISO,
        storagePath: verification.storagePath,
        serverUploadedAtMs: verification.serverUploadedAtMs,
        createdAtMs: nowMs,
      }, {merge: false});
    }
    response = {status: finalStatus, verdict, reason, attachment};
  });

  return response;
}

async function commitBackfilledFingerprint(options) {
  const {db, siteId, verificationId} = options;
  const siteRef = db.collection("users").doc(siteId);
  const verificationRef = siteRef
      .collection("attendancePhotoFingerprints")
      .doc(verificationId);
  const verificationSnapshot = await verificationRef.get();
  if (!verificationSnapshot.exists) {
    throw new Error("Backfill verification does not exist.");
  }
  const verification = verificationSnapshot.data();
  const exactRef = siteRef
      .collection("attendancePhotoExactHashes")
      .doc(verification.byteSha256);
  await db.runTransaction(async (transaction) => {
    const exactSnapshot = await transaction.get(exactRef);
    transaction.set(verificationRef, {
      proofId: verificationId,
      siteId,
      employeeId: verification.employeeId,
      attendanceDateISO: verification.attendanceDateISO,
      storagePath: verification.storagePath,
      storageGeneration: verification.storageGeneration,
      serverUploadedAtMs: verification.serverUploadedAtMs,
      committedAtMs: options.nowMs || Date.now(),
      committed: true,
      backfilled: true,
      verdict: verification.verdict,
      reason: verification.reason,
      possibleReuse: Boolean(verification.possibleReuse),
      matchedDateISO: verification.matchedDateISO || null,
      matchedEmployeeId: verification.matchedEmployeeId || null,
      ...recordFingerprint(verification),
    }, {merge: true});
    if (!exactSnapshot.exists) {
      transaction.set(exactRef, {
        proofId: verificationId,
        siteId,
        employeeId: verification.employeeId,
        attendanceDateISO: verification.attendanceDateISO,
        storagePath: verification.storagePath,
        serverUploadedAtMs: verification.serverUploadedAtMs,
        createdAtMs: options.nowMs || Date.now(),
        backfilled: true,
      }, {merge: false});
    }
  });
}

module.exports = {
  commitBackfilledFingerprint,
  finalizeVerifiedAttendance,
  requiredAttendancePath,
  requiredDateISO,
  requiredHistoricalAttendancePath,
  sanitizeAuditMetadata,
  verificationIdFor,
  verifyAttendancePhotoForSite,
};
