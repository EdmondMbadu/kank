/* eslint-disable require-jsdoc */
const crypto = require("crypto");
const sharp = require("sharp");

const ATTENDANCE_PHOTO_ALGORITHM_VERSION = "phash64-dhash64-luma64-v2";
const ATTENDANCE_PHOTO_HISTORY_DAYS = 31;
const ATTENDANCE_PHOTO_RETENTION_DAYS = 35;
const ATTENDANCE_PHOTO_MAX_CANDIDATES = 40;
const FIRESTORE_ARRAY_ANY_LIMIT = 30;
const LUMA_SIZE = 64;
const PHASH_SIZE = 32;
const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function bitsToHex(bits) {
  let result = "";
  for (let offset = 0; offset < bits.length; offset += 4) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      nibble = (nibble << 1) | (bits[offset + bit] ? 1 : 0);
    }
    result += nibble.toString(16);
  }
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function perceptualHash64(gray32) {
  if (gray32.length !== PHASH_SIZE * PHASH_SIZE) {
    throw new Error("pHash requires a 32x32 grayscale image.");
  }

  const cosine = Array.from({length: 8}, (_, frequency) =>
    Array.from(
        {length: PHASH_SIZE},
        (_, position) => Math.cos(
            ((2 * position + 1) * frequency * Math.PI) /
            (2 * PHASH_SIZE),
        ),
    ),
  );
  const coefficients = [];
  for (let vertical = 0; vertical < 8; vertical += 1) {
    for (let horizontal = 0; horizontal < 8; horizontal += 1) {
      let coefficient = 0;
      for (let y = 0; y < PHASH_SIZE; y += 1) {
        const verticalCosine = cosine[vertical][y];
        for (let x = 0; x < PHASH_SIZE; x += 1) {
          coefficient += gray32[y * PHASH_SIZE + x] *
            cosine[horizontal][x] * verticalCosine;
        }
      }
      coefficients.push(coefficient);
    }
  }

  const threshold = median(coefficients.slice(1));
  return bitsToHex(
      coefficients.map((coefficient, index) =>
        index === 0 ? true : coefficient >= threshold,
      ),
  );
}

function differenceHash64(gray9x8) {
  if (gray9x8.length !== DHASH_WIDTH * DHASH_HEIGHT) {
    throw new Error("dHash requires a 9x8 grayscale image.");
  }

  const bits = [];
  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    for (let x = 0; x < DHASH_WIDTH - 1; x += 1) {
      const current = gray9x8[y * DHASH_WIDTH + x];
      const next = gray9x8[y * DHASH_WIDTH + x + 1];
      bits.push(current >= next);
    }
  }
  return bitsToHex(bits);
}

function hammingDistanceHex(left, right) {
  if (
    typeof left !== "string" ||
    typeof right !== "string" ||
    left.length !== right.length
  ) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const value = parseInt(left[index], 16) ^ parseInt(right[index], 16);
    distance += value.toString(2).replace(/0/g, "").length;
  }
  return distance;
}

function buildBandKeys(pHash64, dHash64) {
  if (
    typeof pHash64 !== "string" || pHash64.length !== 16 ||
    typeof dHash64 !== "string" || dHash64.length !== 16
  ) {
    return [];
  }
  const pairs = (hash) => {
    const result = [];
    for (let left = 0; left < 4; left += 1) {
      for (let right = left + 1; right < 4; right += 1) {
        result.push(
            `${left}${right}:${hash.slice(left * 4, left * 4 + 4)}:` +
            hash.slice(right * 4, right * 4 + 4),
        );
      }
    }
    return result;
  };
  const pPairs = pairs(pHash64);
  const dPairs = pairs(dHash64);
  return pPairs.flatMap((pPair) => dPairs.map((dPair) =>
    `${ATTENDANCE_PHOTO_ALGORITHM_VERSION}:${pPair}:${dPair}`,
  ));
}

function firestoreArrayAnyBatches(values) {
  const batches = [];
  for (
    let index = 0;
    index < values.length;
    index += FIRESTORE_ARRAY_ANY_LIMIT
  ) {
    batches.push(values.slice(index, index + FIRESTORE_ARRAY_ANY_LIMIT));
  }
  return batches;
}

function decodeLuma(base64) {
  if (typeof base64 !== "string" || !base64) return null;
  const decoded = Buffer.from(base64, "base64");
  return decoded.length === LUMA_SIZE * LUMA_SIZE ? decoded : null;
}

function compareLuma(left, right) {
  if (!left || !right || left.length !== right.length || !left.length) {
    return {
      correlation: 0,
      meanAbsoluteDifference: 255,
      brightnessAdjustedDifference: 255,
    };
  }

  let leftMean = 0;
  let rightMean = 0;
  let absoluteDifference = 0;
  for (let index = 0; index < left.length; index += 1) {
    leftMean += left[index];
    rightMean += right[index];
    absoluteDifference += Math.abs(left[index] - right[index]);
  }
  leftMean /= left.length;
  rightMean /= right.length;

  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  let brightnessAdjustedDifference = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
    brightnessAdjustedDifference += Math.abs(leftDelta - rightDelta);
  }

  let correlation = 0;
  if (leftVariance === 0 || rightVariance === 0) {
    correlation = absoluteDifference === 0 ? 1 : 0;
  } else {
    correlation = covariance / Math.sqrt(leftVariance * rightVariance);
  }

  return {
    correlation: Math.max(-1, Math.min(1, correlation)),
    meanAbsoluteDifference: absoluteDifference / left.length,
    brightnessAdjustedDifference:
      brightnessAdjustedDifference / left.length,
  };
}

function compareFingerprints(current, candidate) {
  const pHashDistance = hammingDistanceHex(
      current.pHash64,
      candidate.pHash64,
  );
  const dHashDistance = hammingDistanceHex(
      current.dHash64,
      candidate.dHash64,
  );
  const luma = compareLuma(
      decodeLuma(current.luma64Base64),
      decodeLuma(candidate.luma64Base64),
  );

  const exactBytes = Boolean(
      current.byteSha256 && current.byteSha256 === candidate.byteSha256,
  );
  // Auto-anomaly is intentionally conservative. Perceptual hashes only
  // shortlist. Two independent structural and pixel signals must also agree.
  const nearExactPixels =
    pHashDistance <= 2 &&
    dHashDistance <= 2 &&
    luma.correlation >= 0.9995 &&
    (luma.meanAbsoluteDifference <= 1.25 ||
      luma.brightnessAdjustedDifference <= 0.75);
  const possibleReuse =
    pHashDistance <= 6 &&
    dHashDistance <= 8 &&
    luma.correlation >= 0.985 &&
    luma.meanAbsoluteDifference <= 6;

  return {
    exactBytes,
    duplicate: exactBytes || nearExactPixels,
    possibleReuse,
    pHashDistance,
    dHashDistance,
    correlation: luma.correlation,
    meanAbsoluteDifference: luma.meanAbsoluteDifference,
    brightnessAdjustedDifference: luma.brightnessAdjustedDifference,
  };
}

async function rawGray(buffer, width, height) {
  return sharp(buffer, {
    failOn: "error",
    limitInputPixels: 25 * 1000 * 1000,
  })
      .rotate()
      .flatten({background: "#ffffff"})
      .grayscale()
      .resize(width, height, {fit: "fill", kernel: sharp.kernel.lanczos3})
      .raw()
      .toBuffer();
}

async function createAttendancePhotoFingerprint(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("An image buffer is required.");
  }

  const image = sharp(buffer, {
    failOn: "error",
    limitInputPixels: 25 * 1000 * 1000,
  });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("The attendance photo has invalid dimensions.");
  }

  const [gray32, gray9x8, gray64] = await Promise.all([
    rawGray(buffer, PHASH_SIZE, PHASH_SIZE),
    rawGray(buffer, DHASH_WIDTH, DHASH_HEIGHT),
    rawGray(buffer, LUMA_SIZE, LUMA_SIZE),
  ]);
  const pHash64 = perceptualHash64(gray32);
  const dHash64 = differenceHash64(gray9x8);

  return {
    algorithmVersion: ATTENDANCE_PHOTO_ALGORITHM_VERSION,
    byteSha256: sha256Hex(buffer),
    pHash64,
    dHash64,
    bandKeys: buildBandKeys(pHash64, dHash64),
    luma64Base64: gray64.toString("base64"),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format || "unknown",
  };
}

function publicVerificationResult(record) {
  return {
    verificationId: record.verificationId,
    verdict: record.verdict,
    reason: record.reason,
    matchedDateISO: record.matchedDateISO || null,
    possibleReuse: Boolean(record.possibleReuse),
    algorithmVersion: record.algorithmVersion,
  };
}

module.exports = {
  ATTENDANCE_PHOTO_ALGORITHM_VERSION,
  ATTENDANCE_PHOTO_HISTORY_DAYS,
  ATTENDANCE_PHOTO_MAX_CANDIDATES,
  ATTENDANCE_PHOTO_RETENTION_DAYS,
  buildBandKeys,
  compareFingerprints,
  compareLuma,
  createAttendancePhotoFingerprint,
  differenceHash64,
  firestoreArrayAnyBatches,
  hammingDistanceHex,
  perceptualHash64,
  publicVerificationResult,
  sha256Hex,
};
