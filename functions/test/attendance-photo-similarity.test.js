/* eslint-disable require-jsdoc */
const assert = require("node:assert/strict");
const {test} = require("node:test");
const sharp = require("sharp");
const {
  buildBandKeys,
  compareFingerprints,
  createAttendancePhotoFingerprint,
  firestoreArrayAnyBatches,
  hammingDistanceHex,
} = require("../attendance-photo-similarity");

async function makeWorkplace(options = {}) {
  const accent = options.accent || "#315b7d";
  const personX = options.personX === undefined ? 95 : options.personX;
  const noise = options.noise || 0;
  const svg = Buffer.from(`
    <svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" fill="#d9d1c3"/>
      <rect y="300" width="640" height="180" fill="#81715d"/>
      <rect x="40" y="40" width="210" height="150" fill="#f6f3e9"/>
      <rect x="390" y="35" width="180" height="170" fill="${accent}"/>
      <text x="430" y="130" font-size="28" fill="white">SITE</text>
      <circle cx="${personX}" cy="270" r="38" fill="#583725"/>
      <rect x="${personX - 35}" y="305" width="70" height="110" fill="#1d4f6e"/>
    </svg>
  `);
  let pipeline = sharp(svg).jpeg({quality: options.quality || 88});
  if (noise) pipeline = pipeline.blur(noise);
  return pipeline.toBuffer();
}

test("detects byte-identical photos", async () => {
  const original = await makeWorkplace();
  const current = await createAttendancePhotoFingerprint(original);
  const prior = await createAttendancePhotoFingerprint(original);
  const comparison = compareFingerprints(current, prior);

  assert.equal(comparison.exactBytes, true);
  assert.equal(comparison.duplicate, true);
});

test("detects the same visible photo after JPEG recompression", async () => {
  const original = await makeWorkplace({quality: 94});
  const recompressed = await sharp(original).jpeg({quality: 72}).toBuffer();
  const current = await createAttendancePhotoFingerprint(original);
  const prior = await createAttendancePhotoFingerprint(recompressed);
  const comparison = compareFingerprints(current, prior);

  assert.equal(comparison.exactBytes, false);
  assert.equal(comparison.duplicate, true);
});

test("detects unchanged pixels when only file bytes differ", async () => {
  const original = await makeWorkplace();
  // JPEG decoders ignore bytes after the end marker. This models metadata or
  // container edits that change the file hash without changing the picture.
  const metadataEdited = Buffer.concat([
    original,
    Buffer.from("changed-metadata-and-date"),
  ]);
  const current = await createAttendancePhotoFingerprint(original);
  const prior = await createAttendancePhotoFingerprint(metadataEdited);
  const comparison = compareFingerprints(current, prior);

  assert.equal(comparison.exactBytes, false);
  assert.equal(comparison.duplicate, true);
});

test(
    "detects resizing and mild brightness edits of the same photo",
    async () => {
      const original = await makeWorkplace({quality: 94});
      const resized = await sharp(original)
          .resize({width: 480})
          .jpeg({quality: 82})
          .toBuffer();
      const brightened = await sharp(original)
          .modulate({brightness: 1.01})
          .jpeg({quality: 88})
          .toBuffer();
      const fingerprint = await createAttendancePhotoFingerprint(original);

      assert.equal(
          compareFingerprints(
              fingerprint,
              await createAttendancePhotoFingerprint(resized),
          ).duplicate,
          true,
      );
      assert.equal(
          compareFingerprints(
              fingerprint,
              await createAttendancePhotoFingerprint(brightened),
          ).duplicate,
          true,
      );
    },
);

test("does not flag a new photo from the same workplace", async () => {
  const first = await makeWorkplace({personX: 95});
  const second = await makeWorkplace({personX: 250});
  const current = await createAttendancePhotoFingerprint(first);
  const prior = await createAttendancePhotoFingerprint(second);
  const comparison = compareFingerprints(current, prior);

  assert.equal(comparison.duplicate, false);
});

test("keeps a subtly changed repeat workplace view clear", async () => {
  const first = await makeWorkplace({personX: 95});
  const second = await makeWorkplace({personX: 97});
  const current = await createAttendancePhotoFingerprint(first);
  const prior = await createAttendancePhotoFingerprint(second);
  const comparison = compareFingerprints(current, prior);

  assert.equal(comparison.duplicate, false);
  assert.equal(comparison.possibleReuse, true);
});

test("does not compare unrelated site scenes as duplicates", async () => {
  const first = await makeWorkplace({accent: "#315b7d", personX: 95});
  const second = await makeWorkplace({accent: "#a12b39", personX: 430});
  const current = await createAttendancePhotoFingerprint(first);
  const prior = await createAttendancePhotoFingerprint(second);

  assert.equal(compareFingerprints(current, prior).duplicate, false);
});

test("creates selective locality-sensitive band keys", async () => {
  const fingerprint = await createAttendancePhotoFingerprint(
      await makeWorkplace(),
  );
  const keys = buildBandKeys(fingerprint.pHash64, fingerprint.dHash64);

  assert.equal(keys.length, 36);
  assert.equal(new Set(keys).size, 36);
  assert.deepEqual(
      firestoreArrayAnyBatches(keys).map((batch) => batch.length),
      [30, 6],
  );
});

test("shortlists every fingerprint within the blocking hash distances", () => {
  const original = buildBandKeys(
      "0123456789abcdef",
      "fedcba9876543210",
  );
  // Two changed bits in different 16-bit bands leave at least one two-band
  // pair unchanged for each independent hash.
  const nearby = buildBandKeys(
      "1123456789abcdee",
      "eedcba9876543211",
  );

  assert.ok(original.some((key) => nearby.includes(key)));
});

test("computes Hamming distance safely for 64-bit hashes", () => {
  assert.equal(hammingDistanceHex("0000000000000000", "0000000000000000"), 0);
  assert.equal(hammingDistanceHex("0000000000000000", "ffffffffffffffff"), 64);
  assert.equal(hammingDistanceHex("0f00000000000000", "0000000000000000"), 4);
});
