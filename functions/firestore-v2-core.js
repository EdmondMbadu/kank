/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
"use strict";

const {createHash} = require("crypto");

const SCHEMA_VERSION = 2;
const ENTRY_COLLECTION = "firestoreV2Entries";
const CONTROL_PATH = "migrationControls/firestoreV2";
const MAX_INLINE_PAYLOAD_BYTES = 128 * 1024;
const MAX_CHUNK_BYTES = 96 * 1024;

const layouts = Object.freeze({
  management: {
    mapFields: [
      "moneyInHandsActivities", "expenses", "otherExpenses", "fraudes",
      "reserve", "investment", "moneyGiven", "exchangeLoss",
      "dollarTransferLoss", "bankDepositDollars", "bankDepositFrancs",
      "budgetedExpenses", "moneyInHandsTracking", "monthlyPaymentSnapshots",
    ],
    arrayFields: ["weeklyPaymentTargetPeriods", "weeklyDeductionTargetVersions"],
  },
  user: {
    mapFields: [
      "investments", "investmentsDollar", "performances", "expenses",
      "losses", "reserve", "reserveinDollar", "feesData",
      "dailyMoneyRequests", "dailyLending", "dailySaving",
      "dailySavingReturns", "dailyFeesReturns", "dailyReimbursement",
      "dailyMobileMoneyPayment", "dailyCardPayments", "dailyCardReturns",
      "dailyCardBenefits",
    ],
    arrayFields: ["reviews", "weeklyPaymentTargetPeriods"],
  },
  employee: {
    mapFields: [
      "dailyPoints", "payments", "totalDailyPoints", "dailyStatus",
      "attendance", "attendanceAttachments", "investigationPerformanceMonthly",
    ],
    arrayFields: [
      "paymentsPicturePath", "receipts", "paymentObjectiveWeekDeductions",
      "paymentObjectiveWeekBonuses", "bestTeamTrophies",
      "bestEmployeeTrophies", "foundationRequests",
      "foundationMonthDeductions", "foundationManualBonuses",
    ],
  },
  client: {
    mapFields: [
      "membershipFeePayments", "applicationFeePayments", "payments",
      "paymentSources", "previousPayments", "previousPaymentSources",
      "previousSavingsPayments", "savingsPayments", "galleryPictures",
      "bonusHistory", "trophyAwards", "recoveredAwayDebts",
    ],
    arrayFields: [
      "comments", "previousHomePictures", "auditConversationAudios",
    ],
  },
  card: {
    mapFields: ["payments", "withdrawal", "galleryPictures"],
    arrayFields: [],
  },
  review: {mapFields: [], arrayFields: ["reviews"]},
  certificate: {mapFields: [], arrayFields: ["certificate"]},
  gallery: {mapFields: ["galleryPictures"], arrayFields: []},
  audit: {mapFields: [], arrayFields: ["pendingClients"]},
});

function normalizeForHash(value) {
  if (value === undefined) return {__type: "undefined"};
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return {__type: "date", value: value.toISOString()};
  if (typeof value.toDate === "function") {
    return {__type: "timestamp", value: value.toDate().toISOString()};
  }
  if (Array.isArray(value)) return value.map(normalizeForHash);
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = normalizeForHash(value[key]);
    return result;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(normalizeForHash(value));
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function monthKeyFromLegacyKey(legacyKey, value) {
  const candidates = [legacyKey];
  if (value && typeof value === "object") {
    candidates.push(
        value.createdAt, value.date, value.dateISO, value.awardedOn,
        value.uploadedAt, value.replacedAt, value.monthKey,
    );
    if (value.year && value.month) {
      const monthNumber = Number(value.month);
      if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
        return `${String(value.year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`;
      }
    }
  }

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const text = String(candidate);
    // Most legacy keys begin MM-DD-YYYY and may end in a random numeric
    // suffix. Check that form first so a suffix cannot look like YYYY-MM.
    let match = text.match(/(?:^|\D)(0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](20\d{2})(?:\D|$)/);
    if (match) return `${match[2]}-${String(Number(match[1])).padStart(2, "0")}`;
    match = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])(?:[-/T]|\b)/);
    if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
  }
  return "unknown";
}

function splitUtf8(text, maxBytes = MAX_CHUNK_BYTES) {
  if (!text) return [""];
  const chunks = [];
  let current = "";
  let currentBytes = 0;
  for (const character of text) {
    const characterBytes = byteLength(character);
    if (current && currentBytes + characterBytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += characterBytes;
  }
  if (current || !chunks.length) chunks.push(current);
  return chunks;
}

function describeSourcePath(sourcePath) {
  const parts = String(sourcePath).split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "management") {
    return {kind: "management", entityId: parts[1], ownerUid: null};
  }
  if (parts.length === 2 && parts[0] === "users") {
    return {kind: "user", entityId: parts[1], ownerUid: parts[1]};
  }
  if (parts.length === 4 && parts[0] === "users") {
    const kindByCollection = {
      employees: "employee", clients: "client", cards: "card", reviews: "review",
    };
    const kind = kindByCollection[parts[2]];
    if (kind) return {kind, entityId: parts[3], ownerUid: parts[1]};
  }
  if (parts.length === 2 && layouts[parts[0]]) {
    return {kind: parts[0], entityId: parts[1], ownerUid: null};
  }
  return null;
}

function logicalArrayKey(kind, field, value, index) {
  if (value && typeof value === "object") {
    if (kind === "certificate") {
      return `${value.year || "unknown"}-${value.month || "unknown"}`;
    }
    const stableId = value.id || value.uid || value.pendingId || value.receiptId ||
      value.investigationDayKey || value.createdAt || value.uploadedAt ||
      value.replacedAt || value.time;
    if (stableId) {
      return `${String(stableId)}-${sha256(stableStringify(value)).slice(0, 20)}`;
    }
  }
  return `${index}-${sha256(stableStringify(value)).slice(0, 20)}`;
}

function makeEntry(descriptor, sourcePath, field, legacyKey, value, ordinal = null) {
  const serialized = stableStringify(value);
  const fingerprint = sha256(serialized);
  const id = `${field.slice(0, 48)}--${sha256(`${field}\u0000${legacyKey}`).slice(0, 40)}`;
  const payloadBytes = byteLength(serialized);
  const entry = {
    id,
    schemaVersion: SCHEMA_VERSION,
    sourcePath,
    entityKind: descriptor.kind,
    entityId: descriptor.entityId,
    ownerUid: descriptor.ownerUid,
    field,
    legacyKey,
    monthKey: monthKeyFromLegacyKey(legacyKey, value),
    fingerprint,
    payloadBytes,
    deleted: false,
  };
  if (ordinal !== null) entry.ordinal = ordinal;

  if (payloadBytes <= MAX_INLINE_PAYLOAD_BYTES) {
    entry.value = value;
    return {entry, chunks: []};
  }

  const chunks = splitUtf8(serialized);
  entry.payloadEncoding = "stable-json-chunks-v1";
  entry.chunkCount = chunks.length;
  return {
    entry,
    chunks: chunks.map((data, index) => ({
      id: String(index).padStart(6, "0"), index, data,
      fingerprint: sha256(data), schemaVersion: SCHEMA_VERSION,
    })),
  };
}

function materializeEntries(sourcePath, data) {
  const descriptor = describeSourcePath(sourcePath);
  if (!descriptor || !data) return [];
  const layout = layouts[descriptor.kind];
  const results = [];

  for (const field of layout.mapFields) {
    const map = data[field];
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    for (const legacyKey of Object.keys(map).sort()) {
      results.push(makeEntry(descriptor, sourcePath, field, legacyKey, map[legacyKey]));
    }
  }

  for (const field of layout.arrayFields) {
    const array = data[field];
    if (!Array.isArray(array)) continue;
    array.forEach((value, index) => {
      const legacyKey = logicalArrayKey(descriptor.kind, field, value, index);
      results.push(makeEntry(descriptor, sourcePath, field, legacyKey, value, index));
    });
  }
  return results;
}

function diffEntries(sourcePath, beforeData, afterData) {
  const before = new Map(materializeEntries(sourcePath, beforeData).map((item) => [item.entry.id, item]));
  const after = new Map(materializeEntries(sourcePath, afterData).map((item) => [item.entry.id, item]));
  const upserts = [];
  const tombstones = [];

  for (const [id, item] of after) {
    const previous = before.get(id);
    if (!previous || previous.entry.fingerprint !== item.entry.fingerprint ||
        previous.entry.ordinal !== item.entry.ordinal) {
      upserts.push(item);
    }
  }
  for (const [id, item] of before) {
    if (!after.has(id)) {
      tombstones.push({
        id,
        schemaVersion: SCHEMA_VERSION,
        sourcePath,
        entityKind: item.entry.entityKind,
        entityId: item.entry.entityId,
        ownerUid: item.entry.ownerUid,
        field: item.entry.field,
        legacyKey: item.entry.legacyKey,
        monthKey: item.entry.monthKey,
        fingerprint: item.entry.fingerprint,
        deleted: true,
      });
    }
  }
  return {upserts, tombstones};
}

function reconstructLegacyFields(sourcePath, entries, baseData = {}) {
  const descriptor = describeSourcePath(sourcePath);
  if (!descriptor) return {...baseData};
  const layout = layouts[descriptor.kind];
  const result = {...baseData};
  const mapFields = new Set(layout.mapFields);
  const arrayFields = new Set(layout.arrayFields);
  const arrays = new Map();

  for (const rawEntry of entries) {
    const entry = rawEntry.entry || rawEntry;
    if (!entry || entry.sourcePath !== sourcePath) continue;
    if (mapFields.has(entry.field)) {
      const current = {...(result[entry.field] || {})};
      if (entry.deleted === true) delete current[entry.legacyKey];
      else if (Object.prototype.hasOwnProperty.call(entry, "value")) {
        current[entry.legacyKey] = entry.value;
      }
      result[entry.field] = current;
    } else if (arrayFields.has(entry.field) && entry.deleted !== true &&
        Object.prototype.hasOwnProperty.call(entry, "value")) {
      const current = arrays.get(entry.field) || [];
      current.push({ordinal: Number(entry.ordinal || 0), value: entry.value});
      arrays.set(entry.field, current);
    }
  }

  arrays.forEach((items, field) => {
    result[field] = items.sort((left, right) => left.ordinal - right.ordinal)
        .map((item) => item.value);
  });
  return result;
}

module.exports = {
  CONTROL_PATH,
  ENTRY_COLLECTION,
  MAX_INLINE_PAYLOAD_BYTES,
  SCHEMA_VERSION,
  describeSourcePath,
  diffEntries,
  layouts,
  materializeEntries,
  monthKeyFromLegacyKey,
  reconstructLegacyFields,
  splitUtf8,
  stableStringify,
};
