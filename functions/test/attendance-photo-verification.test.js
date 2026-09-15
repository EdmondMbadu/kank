/* eslint-disable require-jsdoc */
const assert = require("node:assert/strict");
const {test} = require("node:test");
const sharp = require("sharp");
const {
  finalizeVerifiedAttendance,
  requiredAttendancePath,
  requiredDateISO,
  requiredHistoricalAttendancePath,
  sanitizeAuditMetadata,
  verificationIdFor,
  verifyAttendancePhotoForSite,
} = require("../attendance-photo-verification");
const {
  ATTENDANCE_PHOTO_ALGORITHM_VERSION,
  createAttendancePhotoFingerprint,
} = require("../attendance-photo-similarity");
const {
  dateISOFromLegacyLabel,
  listAttendanceProofs,
} = require("../scripts/attendance-photo-fingerprint-backfill");

class MemoryDocumentReference {
  constructor(database, path) {
    this.database = database;
    this.path = path;
  }

  collection(name) {
    return new MemoryCollectionReference(this.database, `${this.path}/${name}`);
  }

  async get() {
    const value = this.database.documents.get(this.path);
    return {
      exists: value !== undefined,
      data: () => value,
    };
  }

  async set(value, options) {
    const previous = this.database.documents.get(this.path) || {};
    this.database.documents.set(
        this.path,
        options && options.merge ? {...previous, ...value} : value,
    );
  }
}

class MemoryCollectionReference {
  constructor(database, path, filters = [], maximum = Infinity) {
    this.database = database;
    this.path = path;
    this.filters = filters;
    this.maximum = maximum;
  }

  doc(id) {
    return new MemoryDocumentReference(this.database, `${this.path}/${id}`);
  }

  where(field, operator, value) {
    return new MemoryCollectionReference(
        this.database,
        this.path,
        [...this.filters, {field, operator, value}],
        this.maximum,
    );
  }

  limit(maximum) {
    return new MemoryCollectionReference(
        this.database,
        this.path,
        this.filters,
        maximum,
    );
  }

  async get() {
    this.database.queryCount += 1;
    const prefix = `${this.path}/`;
    const matches = [];
    for (const [path, value] of this.database.documents.entries()) {
      const suffix = path.startsWith(prefix) ? path.slice(prefix.length) : "";
      if (!suffix || suffix.includes("/")) continue;
      const accepted = this.filters.every((filter) => {
        const actual = value[filter.field];
        if (filter.operator === "==") return actual === filter.value;
        if (filter.operator === ">=") return actual >= filter.value;
        if (filter.operator === "array-contains-any") {
          return Array.isArray(actual) &&
            actual.some((item) => filter.value.includes(item));
        }
        throw new Error(`Unsupported test operator ${filter.operator}`);
      });
      if (accepted) {
        matches.push({id: suffix, data: () => value});
      }
    }
    return {docs: matches.slice(0, this.maximum)};
  }
}

class MemoryFirestore {
  constructor(entries) {
    this.documents = new Map(entries);
    this.writes = [];
    this.queryCount = 0;
  }

  collection(name) {
    return new MemoryCollectionReference(this, name);
  }

  async runTransaction(handler) {
    const transaction = {
      get: (reference) => reference.get(),
      set: (reference, value, options) => {
        this.writes.push({path: reference.path, value, options});
        const previous = this.documents.get(reference.path) || {};
        this.documents.set(
            reference.path,
            options && options.merge ? {...previous, ...value} : value,
        );
      },
    };
    return handler(transaction);
  }
}

async function workplacePhoto(quality = 90) {
  return sharp(Buffer.from(`
    <svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" fill="#d9d1c3"/>
      <rect y="300" width="640" height="180" fill="#81715d"/>
      <rect x="40" y="40" width="210" height="150" fill="#f6f3e9"/>
      <rect x="390" y="35" width="180" height="170" fill="#315b7d"/>
      <circle cx="95" cy="270" r="38" fill="#583725"/>
    </svg>
  `)).jpeg({quality}).toBuffer();
}

function testBucket(
    storagePath,
    image,
    createdAtMs,
    reportedSize = image.length,
) {
  const file = {
    exists: async () => [true],
    getMetadata: async () => [{
      contentType: "image/jpeg",
      size: String(reportedSize),
      generation: "2",
      timeCreated: new Date(createdAtMs).toISOString(),
      metadata: {firebaseStorageDownloadTokens: "download-token"},
    }],
    download: async () => [image],
  };
  return {
    name: "test.appspot.com",
    file: (requestedPath) => {
      assert.equal(requestedPath, storagePath);
      return file;
    },
  };
}

function readyVerification(overrides = {}) {
  return {
    verificationId: "verification-1",
    verificationState: "ready",
    verdict: "clear",
    reason: "unique",
    possibleReuse: false,
    algorithmVersion: "test-v1",
    siteId: "site-1",
    employeeId: "employee-2",
    attendanceDateISO: "2026-03-28",
    storagePath:
      "attendance_proofs/site-1/employee-2/2026-03-28/photo.jpg",
    storageGeneration: "42",
    contentType: "image/jpeg",
    size: 240000,
    downloadURL: "https://firebase.test/photo",
    serverUploadedAtMs: 1774688400000,
    checkedAtMs: 1774688400500,
    byteSha256: "a".repeat(64),
    pHash64: "0123456789abcdef",
    dHash64: "fedcba9876543210",
    bandKeys: ["test:p0:0123"],
    luma64Base64: Buffer.alloc(4096).toString("base64"),
    ...overrides,
  };
}

test("rejects dates and paths outside authenticated site scope", () => {
  assert.throws(() => requiredDateISO("2026-02-31"), /dateISO is invalid/);
  assert.throws(
      () => requiredAttendancePath(
          "site-1",
          "employee-2",
          "2026-03-28",
          "attendance_proofs/site-2/employee-2/2026-03-28/photo.jpg",
      ),
      /path is invalid/,
  );
  assert.throws(
      () => requiredAttendancePath(
          "site-1",
          "employee-2",
          "2026-03-28",
          "attendance_proofs/site-1/employee-1/2026-03-28/photo.jpg",
      ),
      /path is invalid/,
  );
});

test("creates an idempotent verification id for one storage generation", () => {
  const first = verificationIdFor("proof/path.jpg", "42");
  const retry = verificationIdFor("proof/path.jpg", "42");
  const replacement = verificationIdFor("proof/path.jpg", "43");

  assert.equal(first, retry);
  assert.notEqual(first, replacement);
  assert.match(first, /^[a-f0-9]{48}$/);
});

test("historical migration paths stay date-bound", () => {
  const migratedPath =
    "attendance_proofs/old-site/old-employee/2026-03-28/photo.jpg";
  assert.equal(
      requiredHistoricalAttendancePath("2026-03-28", migratedPath),
      migratedPath,
  );
  assert.throws(
      () => requiredHistoricalAttendancePath("2026-03-29", migratedPath),
      /historical attendance photo path is invalid/,
  );
  assert.throws(
      () => requiredHistoricalAttendancePath(
          "2026-03-28",
          "attendance_proofs/old-site/../2026-03-28/photo.jpg",
      ),
      /historical attendance photo path is invalid/,
  );
});

test("finds cross-employee recompressed site photos", async () => {
  const nowMs = Date.UTC(2026, 2, 28, 12);
  const priorImage = await workplacePhoto(94);
  const currentImage = await sharp(priorImage).jpeg({quality: 72}).toBuffer();
  const prior = await createAttendancePhotoFingerprint(priorImage);
  const db = new MemoryFirestore([
    ["users/site-1/attendancePhotoFingerprints/prior-proof", {
      ...prior,
      proofId: "prior-proof",
      committed: true,
      algorithmVersion: ATTENDANCE_PHOTO_ALGORITHM_VERSION,
      employeeId: "employee-1",
      attendanceDateISO: "2026-03-27",
      storagePath:
        "attendance_proofs/site-1/employee-1/2026-03-27/prior.jpg",
      serverUploadedAtMs: nowMs - 86400000,
    }],
  ]);
  const storagePath =
    "attendance_proofs/site-1/employee-2/2026-03-28/current.jpg";

  const result = await verifyAttendancePhotoForSite({
    db,
    bucket: testBucket(storagePath, currentImage, nowMs),
    siteId: "site-1",
    employeeId: "employee-2",
    dateISO: "2026-03-28",
    storagePath,
    nowMs,
  });

  assert.equal(result.verdict, "duplicate");
  assert.equal(result.reason, "near_exact_visual");
  assert.equal(result.matchedDateISO, "2026-03-27");
  assert.equal(result.matchedEmployeeId, undefined);
  assert.equal(db.queryCount, 2);
  const stored = db.documents.get(
      `users/site-1/attendancePhotoFingerprints/${result.verificationId}`,
  );
  assert.equal(stored.expiresAt.getTime(), nowMs + 35 * 86400000);
});

test("ignores approximate matches older than 31 days", async () => {
  const nowMs = Date.UTC(2026, 2, 28, 12);
  const priorImage = await workplacePhoto(94);
  const currentImage = await sharp(priorImage).jpeg({quality: 72}).toBuffer();
  const prior = await createAttendancePhotoFingerprint(priorImage);
  const db = new MemoryFirestore([
    ["users/site-1/attendancePhotoFingerprints/old-proof", {
      ...prior,
      proofId: "old-proof",
      committed: true,
      algorithmVersion: ATTENDANCE_PHOTO_ALGORITHM_VERSION,
      employeeId: "employee-1",
      attendanceDateISO: "2026-02-24",
      storagePath:
        "attendance_proofs/site-1/employee-1/2026-02-24/old.jpg",
      serverUploadedAtMs: nowMs - 32 * 86400000,
    }],
  ]);
  const storagePath =
    "attendance_proofs/site-1/employee-2/2026-03-28/current-old.jpg";

  const result = await verifyAttendancePhotoForSite({
    db,
    bucket: testBucket(storagePath, currentImage, nowMs),
    siteId: "site-1",
    employeeId: "employee-2",
    dateISO: "2026-03-28",
    storagePath,
    nowMs,
  });

  assert.equal(result.verdict, "clear");
  assert.equal(result.reason, "unique");
});

test("keeps live size cap with a bounded historical override", async () => {
  const nowMs = Date.UTC(2026, 2, 28, 12);
  const image = await workplacePhoto();
  const storagePath =
    "attendance_proofs/site-1/employee-2/2026-03-28/large-history.jpg";
  const reportedSize = 3 * 1024 * 1024;
  const bucket = testBucket(storagePath, image, nowMs, reportedSize);

  await assert.rejects(
      verifyAttendancePhotoForSite({
        db: new MemoryFirestore([]),
        bucket,
        siteId: "site-1",
        employeeId: "employee-2",
        dateISO: "2026-03-28",
        storagePath,
        nowMs,
      }),
      /too large/,
  );

  const result = await verifyAttendancePhotoForSite({
    db: new MemoryFirestore([]),
    bucket,
    siteId: "site-1",
    employeeId: "employee-2",
    dateISO: "2026-03-28",
    storagePath,
    nowMs,
    maxPhotoBytes: 20 * 1024 * 1024,
  });

  assert.equal(result.verdict, "clear");
});

test("sanitizes client audit metadata before storing it", () => {
  const sanitized = sanitizeAuditMetadata({
    takenAt: 1774688400000,
    takenAtSource: "exif".repeat(30),
    photoHash: "ABCDEF".repeat(11),
    device: {make: "m".repeat(100), model: "phone"},
    ua: {mobile: true, platform: "Android", ua: "u".repeat(800)},
    softDeviceId: "s".repeat(200),
  });

  assert.equal(sanitized.takenAt, 1774688400000);
  assert.equal(sanitized.takenAtSource.length, 40);
  assert.equal(sanitized.device.make.length, 80);
  assert.equal(sanitized.ua.ua.length, 400);
  assert.equal(sanitized.softDeviceId.length, 120);
  assert.equal(sanitized.photoHash, null);
});

test("finalization rechecks a newly committed near-exact photo", async () => {
  const nowMs = Date.UTC(2026, 2, 28, 12);
  const priorImage = await workplacePhoto(94);
  const currentImage = await sharp(priorImage).jpeg({quality: 72}).toBuffer();
  const prior = await createAttendancePhotoFingerprint(priorImage);
  const current = await createAttendancePhotoFingerprint(currentImage);
  const verificationPath =
    "users/site-1/attendancePhotoFingerprints/verification-1";
  const db = new MemoryFirestore([
    [verificationPath, readyVerification({
      ...current,
      algorithmVersion: ATTENDANCE_PHOTO_ALGORITHM_VERSION,
    })],
    ["users/site-1/attendancePhotoFingerprints/prior-proof", {
      ...prior,
      proofId: "prior-proof",
      committed: true,
      algorithmVersion: ATTENDANCE_PHOTO_ALGORITHM_VERSION,
      employeeId: "employee-1",
      attendanceDateISO: "2026-03-27",
      storagePath:
        "attendance_proofs/site-1/employee-1/2026-03-27/prior.jpg",
      serverUploadedAtMs: nowMs - 86400000,
    }],
  ]);

  const result = await finalizeVerifiedAttendance({
    db,
    siteId: "site-1",
    employeeId: "employee-2",
    dateISO: "2026-03-28",
    dateLabel: "3-28-2026-9-0-0",
    requestedStatus: "P",
    verificationId: "verification-1",
    nowMs,
  });

  assert.equal(result.status, "F");
  assert.equal(result.verdict, "duplicate");
  assert.equal(result.reason, "near_exact_visual");
  assert.equal(db.queryCount, 2);
});

test("finalization catches cross-employee exact races", async () => {
  const verificationPath =
    "users/site-1/attendancePhotoFingerprints/verification-1";
  const exactPath = `users/site-1/attendancePhotoExactHashes/${"a".repeat(64)}`;
  const db = new MemoryFirestore([
    [verificationPath, readyVerification()],
    [exactPath, {
      storagePath:
        "attendance_proofs/site-1/employee-1/2026-03-27/earlier.jpg",
      employeeId: "employee-1",
      attendanceDateISO: "2026-03-27",
    }],
  ]);

  const result = await finalizeVerifiedAttendance({
    db,
    siteId: "site-1",
    employeeId: "employee-2",
    dateISO: "2026-03-28",
    dateLabel: "3-28-2026-9-0-0",
    requestedStatus: "P",
    verificationId: "verification-1",
    nowMs: 1774688410000,
    auditMetadata: {takenAtSource: "exif"},
  });

  assert.equal(result.status, "F");
  assert.equal(result.verdict, "duplicate");
  assert.equal(result.reason, "exact_hash");
  assert.equal(
      db.documents.get(
          "users/site-1/employees/employee-2/attendance/2026-03-28",
      ).status,
      "F",
  );
  assert.equal(
      db.documents.get(
          "users/site-1/attendancePhotoFingerprints/verification-1",
      ).matchedEmployeeId,
      "employee-1",
  );
});

test("inventories every historical proof shape", async () => {
  assert.equal(dateISOFromLegacyLabel("3-28-2026-9-0-0"), "2026-03-28");
  assert.equal(dateISOFromLegacyLabel("2-31-2026"), "");

  const legacyPath =
    "attendance_proofs/site-1/employee-1/2026-03-28/legacy.jpg";
  const attachmentPath =
    "attendance_proofs/site-1/employee-1/2026-03-29/attachment.jpg";
  const attendanceDocuments = [
    {
      id: "2026-03-28",
      data: () => ({proof: {path: legacyPath}}),
      ref: {},
    },
    {
      id: "2026-03-29",
      data: () => ({}),
      ref: {
        collection: () => ({
          get: async () => ({
            docs: [{data: () => ({path: attachmentPath})}],
          }),
        }),
      },
    },
  ];
  const employeeDocument = {
    id: "employee-1",
    data: () => ({
      attendanceAttachments: {
        "3-28-2026-9-0-0": {path: legacyPath},
        "1-1-2025-9-0-0": {path: "attendance_proofs/old.jpg"},
      },
    }),
    ref: {
      collection: () => ({
        where: () => ({get: async () => ({docs: attendanceDocuments})}),
      }),
    },
  };
  const db = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          select: (field) => {
            assert.equal(field, "attendanceAttachments");
            return {get: async () => ({docs: [employeeDocument]})};
          },
        }),
      }),
    }),
  };

  const proofs = await listAttendanceProofs(db, "site-1", "2026-03-01");

  assert.deepEqual(proofs, [
    {employeeId: "employee-1", dateISO: "2026-03-28", storagePath: legacyPath},
    {
      employeeId: "employee-1",
      dateISO: "2026-03-29",
      storagePath: attachmentPath,
    },
  ]);
});
