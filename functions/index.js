/* eslint-disable brace-style */
/* eslint-disable require-jsdoc */
/* eslint-disable valid-jsdoc */
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const AfricasTalking = require("africastalking");
const twilio = require("twilio");

// Initialize Firebase Admin
admin.initializeApp();

// Retrieve Africa's Talking credentials from environment variables
const atConfig = (functions.config() && functions.config().africastalking) || {};
const apiKey = atConfig.api_key || process.env.AFRICASTALKING_API_KEY || "";
const username = atConfig.username || process.env.AFRICASTALKING_USERNAME || "";
const db = admin.firestore();

// Initialize Africa's Talking SDK (deferred if credentials are missing in emulator)
let sms = null;
if (apiKey && username) {
  // eslint-disable-next-line new-cap
  const africastalking = AfricasTalking({apiKey, username});
  sms = africastalking.SMS;
}

const KINSHASA_TIME_ZONE = "Africa/Kinshasa";
const FLEXPAY_CALLBACK_URL_FALLBACK = "https://kank-4bbbc.web.app/";
const DEFAULT_PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
const FLEXPAY_CALLBACK_HTTP_URL_DEFAULT = DEFAULT_PROJECT_ID ?
  `https://us-central1-${DEFAULT_PROJECT_ID}.cloudfunctions.net/flexpayMobileMoneyCallback` :
  FLEXPAY_CALLBACK_URL_FALLBACK;
const MOBILE_MONEY_LOOKUP_COLLECTION = "mobileMoneyTransactionLookup";

const flexpayConfig = (functions.config() && functions.config().flexpay) || {};
const FLEXPAY_MERCHANT =
  flexpayConfig.merchant || process.env.FLEXPAY_MERCHANT || "";
const FLEXPAY_TOKEN = flexpayConfig.token || process.env.FLEXPAY_TOKEN || "";
function resolveFlexpayCallbackUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return FLEXPAY_CALLBACK_HTTP_URL_DEFAULT;
  const normalized = trimmed.replace(/\/+$/, "");
  if (
    normalized === FLEXPAY_CALLBACK_URL_FALLBACK.replace(/\/+$/, "") ||
    normalized.endsWith(".web.app")
  ) {
    return FLEXPAY_CALLBACK_HTTP_URL_DEFAULT;
  }
  return trimmed;
}

const FLEXPAY_CALLBACK_URL = resolveFlexpayCallbackUrl(
    flexpayConfig.callback_url || process.env.FLEXPAY_CALLBACK_URL || "",
);
const FLEXPAY_PAYMENT_URL =
  flexpayConfig.payment_url ||
  process.env.FLEXPAY_PAYMENT_URL ||
  "https://backend.flexpay.cd/api/rest/v1/paymentService";
const FLEXPAY_CHECK_URL_BASE =
  flexpayConfig.check_url_base ||
  process.env.FLEXPAY_CHECK_URL_BASE ||
  "https://apicheck.flexpaie.com/api/rest/v1/check";
const FLEXPAY_CHECK_URL_BASE_FALLBACK =
  flexpayConfig.check_url_base_fallback ||
  process.env.FLEXPAY_CHECK_URL_BASE_FALLBACK ||
  "https://backend.flexpay.cd/api/rest/v1/check";
const CAPTURE_GRACE_WINDOW_MS = 180000;
/**
 * Formats a phone number to E.164 standard based on its origin.
 * - If the number starts with '0', it's treated as a DRC number.
 *   - Removes the leading '0' and adds '+243'.
 * - Otherwise, it's treated as a US number.
 *   - If 10 digits, adds '+1'.
 *   - If 11 digits starting with '1', adds '+' without altering digits.
 * - Returns null for invalid formats.
 *
 * @param {string} number - The raw phone number input.
 * @return {string|null} - The formatted E.164 phone number or null if invalid.
 */
function makeValidE164(number) {
  // Remove all non-digit characters
  const cleaned = ("" + number).replace(/\D/g, "");

  // Check if the number starts with '0' (DRC)
  if (cleaned.startsWith("0")) {
    const withoutZero = cleaned.slice(1); // Remove the leading '0'
    return `+243${withoutZero}`;
  }

  // Check for US numbers with 10 digits
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Check for US numbers with 11 digits starting with '1'
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // If none of the above conditions are met, return null
  console.log(`Invalid phone number format: ${number}`);
  return null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * FlexPay expects DRC mobile number in 243XXXXXXXXX format (without +).
 * Accepts:
 * - 0XXXXXXXXX (10 digits local)
 * - XXXXXXXXX (9 digits local)
 * - 243XXXXXXXXX (international, no plus)
 * - +243XXXXXXXXX (international, with plus)
 *
 * @param {string} raw
 * @return {string|null}
 */
function normalizePhoneForFlexpay(raw) {
  const digits = sanitizeDigits(raw);

  if (digits.length === 10 && digits.startsWith("0")) {
    return `243${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `243${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("243")) {
    return digits;
  }
  return null;
}

function parseMonthDayYear(dateString) {
  if (!dateString || typeof dateString !== "string") return null;
  const parts = dateString.split("-").map((x) => Number(x));
  if (parts.length < 3 || parts.some((x) => !Number.isFinite(x))) return null;
  const [month, day, year] = parts;
  return new Date(year, month - 1, day);
}

function formatMonthDayYear(date) {
  return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
}

function weeksSince(dateString) {
  const givenDate = new Date(dateString);
  const today = new Date();

  if (!Number.isFinite(givenDate.getTime())) return 0;

  givenDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const daysPassed = (today - givenDate) / millisecondsPerDay;
  return Math.floor(daysPassed / 7);
}

function isGivenDateLessOrEqual(dateX, today) {
  const x = parseMonthDayYear(dateX);
  const t = parseMonthDayYear(today);
  if (!x || !t) return false;
  return t <= x;
}

function weeksElapsed(dateX, today) {
  const x = parseMonthDayYear(dateX);
  const t = parseMonthDayYear(today);
  if (!x || !t) return 0;
  const diff = Math.abs(x.getTime() - t.getTime());
  const msInWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(diff / msInWeek);
}

function getDateInWeeksPlus(inputDate, weeksToAdd) {
  const start = parseMonthDayYear(inputDate);
  if (!start) return "";
  const copy = new Date(start);
  copy.setDate(copy.getDate() + weeksToAdd * 7);
  return formatMonthDayYear(copy);
}

function computeUpdatedCreditScore(clientData, paymentAmount, newDebtLeft, todayMdy) {
  if (newDebtLeft > 0) {
    return String(clientData.creditScore || "0");
  }
  if (paymentAmount <= 0) {
    return String(clientData.creditScore || "0");
  }

  const period = Number(clientData.paymentPeriodRange || 0);
  const start = clientData.debtCycleStartDate || "";
  let targetDate = "";

  if (period === 4) {
    targetDate = getDateInWeeksPlus(start, 5);
  } else if (period === 8) {
    targetDate = getDateInWeeksPlus(start, 9);
  } else {
    return String(clientData.creditScore || "0");
  }

  const prev = toNumber(clientData.creditScore || 0);
  if (isGivenDateLessOrEqual(targetDate, todayMdy)) {
    return String(prev + 5);
  }
  const elapsed = weeksElapsed(targetDate, todayMdy);
  return String(prev - 2 * elapsed);
}

function isWorkingEmployeeForMobileMoney(employee) {
  if (!employee) return false;
  const raw =
    employee.status || employee.workStatus || employee.employmentStatus || "";
  const val = String(raw).trim().toLowerCase();
  return ["travaille", "tavaille", "en travail", "working", "work"].includes(
      val,
  );
}

function toFlexpayBearer(value) {
  const token = String(value || "").trim();
  if (!token) return "";
  if (token.toLowerCase().startsWith("bearer ")) return token;
  return `Bearer ${token}`;
}

function normalizeStatusToken(raw) {
  return String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
}

const SUCCESS_STATUS_TOKENS = new Set([
  "0",
  "SUCCESS",
  "SUCCES",
  "APPROVED",
  "APPROUVE",
]);
const PENDING_STATUS_TOKENS = new Set([
  "",
  "PENDING",
  "EN ATTENTE",
  "EN_ATTENTE",
  "PROCESSING",
  "IN_PROGRESS",
  "IN PROGRESS",
]);
const FAILURE_STATUS_TOKENS = new Set([
  "1",
  "FAILED",
  "FAIL",
  "ECHEC",
  "ECHOUE",
  "DECLINED",
  "DECLINE",
  "CANCELED",
  "CANCELLED",
  "REFUSED",
  "REJECTED",
]);
const FAILURE_KEYWORDS = [
  "INSUFF",
  "FAILED",
  "ECHEC",
  "ECHOUE",
  "REFUS",
  "DECLIN",
  "CANCEL",
  "REJECT",
];
const PENDING_KEYWORDS = [
  "EN ATTENTE",
  "PENDING",
  "PROCESSING",
];
const CAPTURE_TRANSFER_KEYWORDS = [
  "CAPTURE",
  "CAPTUER",
  "ENVOI EN COURS",
  "DANS VOTRE COMPTE",
];

function anyKeywordMatch(values, keywords) {
  const haystacks = (values || []).map((v) => normalizeStatusToken(v));
  return keywords.some((keyword) => haystacks.some((h) => h.includes(keyword)));
}

function classifyMobileMoneyStatus({
  code,
  providerStatus,
  providerReference,
  message,
  reason,
  transactionExists,
  callbackCode,
  callbackStatus,
  callbackMessage,
  previousStatus,
  previousCapturedPendingSinceMs,
  nowMs,
  applyGraceWindow,
}) {
  const now = toNumber(nowMs || Date.now());
  const normalizedCode = normalizeStatusToken(code || "");
  const normalizedProviderStatus = normalizeStatusToken(providerStatus || "");
  const providerRefExists = Boolean(String(providerReference || "").trim());
  const normalizedCallbackCode = normalizeStatusToken(callbackCode || "");
  const normalizedCallbackStatus = normalizeStatusToken(callbackStatus || "");
  const hasCallbackStatusToken = normalizedCallbackStatus.length > 0;
  const textValues = [message || "", reason || "", callbackMessage || ""];

  const hasFailureKeyword = anyKeywordMatch(textValues, FAILURE_KEYWORDS);
  const callbackFailed =
    (normalizedCallbackCode && normalizedCallbackCode !== "0") ||
    FAILURE_STATUS_TOKENS.has(normalizedCallbackStatus);
  const hasFailureSignal =
    FAILURE_STATUS_TOKENS.has(normalizedProviderStatus) ||
    callbackFailed ||
    hasFailureKeyword;

  const hasCaptureKeyword = anyKeywordMatch(textValues, CAPTURE_TRANSFER_KEYWORDS);
  const captureEligible =
    normalizedCode === "0" &&
    Boolean(transactionExists) &&
    hasCaptureKeyword &&
    !hasFailureSignal;

  const hasPendingKeyword = anyKeywordMatch(textValues, PENDING_KEYWORDS);
  const providerStatusPendingSignal =
    PENDING_STATUS_TOKENS.has(normalizedProviderStatus) &&
    !(
      normalizedProviderStatus === "" &&
      normalizedCode === "0" &&
      Boolean(transactionExists) &&
      providerRefExists
    );
  const hasPendingSignal =
    providerStatusPendingSignal ||
    (hasCallbackStatusToken && PENDING_STATUS_TOKENS.has(normalizedCallbackStatus)) ||
    hasPendingKeyword ||
    (normalizedCode === "1" && !transactionExists && !hasFailureSignal);

  const inferredProviderSuccessSignal =
    normalizedCode === "0" &&
    Boolean(transactionExists) &&
    providerRefExists &&
    !hasFailureSignal &&
    !hasCaptureKeyword &&
    !hasPendingKeyword &&
    !FAILURE_STATUS_TOKENS.has(normalizedProviderStatus) &&
    !(PENDING_STATUS_TOKENS.has(normalizedProviderStatus) && normalizedProviderStatus !== "");
  const explicitSuccessSignal =
    (normalizedCode === "0" && SUCCESS_STATUS_TOKENS.has(normalizedProviderStatus)) ||
    (normalizedCallbackCode === "0" && SUCCESS_STATUS_TOKENS.has(normalizedCallbackStatus)) ||
    inferredProviderSuccessSignal;

  let status = "PENDING";
  let capturedPendingSinceMs = null;
  let captureStableForMs = 0;

  if (hasFailureSignal) {
    status = "FAILED";
  } else if (captureEligible) {
    const previousCapturedMs = toNumber(previousCapturedPendingSinceMs || 0);
    const startedAtMs =
      normalizeStatusToken(previousStatus || "") === "CAPTURED_PENDING" && previousCapturedMs > 0 ?
      previousCapturedMs :
      now;
    capturedPendingSinceMs = startedAtMs;
    captureStableForMs = Math.max(0, now - startedAtMs);
    if ((applyGraceWindow !== false) && captureStableForMs >= CAPTURE_GRACE_WINDOW_MS) {
      status = "SUCCESS";
    } else {
      status = "CAPTURED_PENDING";
    }
  } else if (explicitSuccessSignal) {
    status = "SUCCESS";
  } else if (hasPendingSignal) {
    status = "PENDING";
  } else {
    status = "PENDING";
  }

  const failureReason = hasFailureSignal ?
    String(reason || message || callbackMessage || "").trim() :
    "";

  return {
    status,
    failureReason,
    hasFailureSignal,
    hasCaptureKeyword,
    hasPendingSignal,
    explicitSuccessSignal,
    capturedPendingSinceMs,
    captureStableForMs,
  };
}

function uniqueNonEmpty(values) {
  return [...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

async function upsertMobileMoneyLookup(reference, payload) {
  const ref = String(reference || "").trim();
  if (!ref) return;
  await db.doc(`${MOBILE_MONEY_LOOKUP_COLLECTION}/${ref}`).set({
    reference: ref,
    updatedAtMs: Date.now(),
    ...(payload || {}),
  }, {merge: true});
}

async function runFlexpayCheck(orderNumber, reference) {
  const bases = uniqueNonEmpty([
    FLEXPAY_CHECK_URL_BASE,
    FLEXPAY_CHECK_URL_BASE_FALLBACK,
  ]);
  const identifiers = uniqueNonEmpty([orderNumber, reference]);
  let firstJson = null;
  let firstSource = null;
  let best = null;

  for (const base of bases) {
    for (const identifier of identifiers) {
      const url = `${base}/${encodeURIComponent(identifier)}`;
      try {
        const resp = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": toFlexpayBearer(FLEXPAY_TOKEN),
          },
        });
        const json = await resp.json();
        const code = String((json && json.code) || "");
        const tx = (json && json.transaction) || null;
        const message = String((json && json.message) || "");
        const providerStatus = normalizeStatusToken(tx && tx.status);
        const providerReason = normalizeStatusToken(
            (tx &&
              (tx.reason ||
                tx.statusMessage ||
                tx.message ||
                tx.errorMessage ||
                tx.error)) ||
            "",
        );
        const providerReference = String(
            (tx &&
              (tx.provider_reference ||
                tx.providerReference ||
                tx.provider_ref ||
                tx.providerRef)) ||
            json.provider_reference ||
            json.providerReference ||
            "",
        ).trim();
        const providerRefExists = Boolean(providerReference);
        const classification = classifyMobileMoneyStatus({
          code,
          providerStatus,
          providerReference,
          message,
          reason: providerReason,
          transactionExists: Boolean(tx),
          nowMs: Date.now(),
          applyGraceWindow: false,
        });
        // Cross-endpoint selection:
        // keep FAILED/CAPTURED_PENDING highest, then choose the most credible
        // candidate among SUCCESS/PENDING so stale "no transaction found" does not
        // override an explicit success transaction.
        const semanticRank =
          classification.status === "FAILED" ?
          4 :
          classification.status === "CAPTURED_PENDING" ?
          3 :
          classification.status === "SUCCESS" ?
          2 :
          1;
        const confidenceScore =
          (tx ? 25 : 0) +
          (code === "0" ? 20 : 0) +
          (classification.explicitSuccessSignal ? 35 : 0) +
          (providerRefExists ? 15 : 0) +
          (classification.hasCaptureKeyword ? 12 : 0) +
          (classification.hasPendingSignal ? -10 : 0) +
          (classification.status === "PENDING" && !tx ? -30 : 0) +
          (message ? 1 : 0);
        const qualityScore = semanticRank * 100 + confidenceScore;

        console.log("FlexPay check candidate:", {
          base,
          identifier,
          code,
          hasTransaction: Boolean(tx),
          providerStatus,
          providerReference: providerReference || null,
          statusHint: classification.status,
          qualityScore,
          message,
        });

        if (!firstJson) {
          firstJson = json;
          firstSource = {base, identifier};
        }

        if (!best || qualityScore > best.qualityScore) {
          best = {
            json,
            source: {base, identifier},
            qualityScore,
            statusHint: classification.status,
          };
        }
      } catch (error) {
        console.error("FlexPay check candidate failed:", {
          base,
          identifier,
          message: error && error.message ? error.message : String(error),
        });
      }
    }
  }

  if (best) {
    return {json: best.json, source: best.source, statusHint: best.statusHint};
  }

  return {
    json: firstJson || {code: "1", message: "No check response received"},
    source: firstSource || {base: "", identifier: ""},
    statusHint: "PENDING",
  };
}

function parseLocalDateTimeInput(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const [datePart, timePart] = trimmed.split("T");
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const values = [year, month, day, hour, minute];
  if (values.some((v) => !Number.isFinite(v))) return null;

  return {year, month, day, hour, minute};
}

function getTimeZoneOffsetMs(timeZone, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const vals = {};
  for (const part of parts) {
    if (part.type !== "literal") vals[part.type] = part.value;
  }

  const asUtc = Date.UTC(
      Number(vals.year),
      Number(vals.month) - 1,
      Number(vals.day),
      Number(vals.hour),
      Number(vals.minute),
      Number(vals.second),
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtcMs(localDateTime, timeZone) {
  const parts = parseLocalDateTimeInput(localDateTime);
  if (!parts) return null;

  const utcDate = new Date(Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
  ));

  const offsetMs = getTimeZoneOffsetMs(timeZone, utcDate);
  return utcDate.getTime() - offsetMs;
}

/**
 * Callable: send a custom SMS to a single client.
 * Payload: { phoneNumber: string, message: string, metadata?: {...} }
 */
exports.sendCustomSMS = functions.https.onCall(async (data, context) => {
  // OPTIONAL: lock to signed-in users (and optionally admin role)
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated','Sign in required');
  // }
  // const isAdmin = context.auth.token?.admin === true;
  // if (!isAdmin) throw new functions.https.HttpsError('permission-denied','Admin only');

  const {phoneNumber, message, metadata = {}} = data || {};
  if (!phoneNumber || !message) {
    throw new functions.https.HttpsError("invalid-argument", "phoneNumber and message are required");
  }

  const to = makeValidE164(phoneNumber);
  if (!to) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid phone number");
  }

  try {
    const resp = await sms.send({to: [to], message});
    // Optional audit trail
    // await admin.firestore().collection('sms_outbox').add({
    //   to, message, metadata,
    //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
    //   byUid: context.auth?.uid || null
    // });
    console.log("SMS medata:", metadata);
    console.log("SMS sent successfully:", resp || "No response received ");
    return {ok: true, providerResponse: resp};
  } catch (err) {
    console.error("sendCustomSMS failed:", err);
    throw new functions.https.HttpsError("internal", "SMS send failed");
  }
});

exports.initMobileMoneyPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }
  if (!FLEXPAY_MERCHANT || !FLEXPAY_TOKEN) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "FlexPay configuration is missing on the server.",
    );
  }

  const ownerUid = context.auth.uid;
  const {
    clientUid,
    paymentAmount,
    savingsAmount = "0",
    currency = "CDF",
    phone,
    dayKey,
    paymentEntryKey,
  } = data || {};

  if (!clientUid) {
    throw new functions.https.HttpsError("invalid-argument", "clientUid is required.");
  }

  const paymentNum = toNumber(paymentAmount);
  const savingsNum = toNumber(savingsAmount);
  if (paymentNum < 0 || savingsNum < 0) {
    throw new functions.https.HttpsError("invalid-argument", "Amounts must be positive.");
  }
  if (paymentNum <= 0 && savingsNum <= 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "At least one amount must be greater than zero.",
    );
  }

  const phoneNormalized = normalizePhoneForFlexpay(phone);
  if (!phoneNormalized) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid DRC phone number format.",
    );
  }

  const clientRef = db.doc(`users/${ownerUid}/clients/${clientUid}`);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Client not found.");
  }

  const createdAtMs = Date.now();
  const reference = `KANK-${ownerUid.slice(0, 6)}-${clientUid.slice(0, 6)}-${createdAtMs}`;

  const requestBody = {
    merchant: FLEXPAY_MERCHANT,
    type: "1",
    reference,
    phone: phoneNormalized,
    amount: String(paymentNum),
    currency: String(currency || "CDF").toUpperCase(),
    callbackUrl: FLEXPAY_CALLBACK_URL,
  };

  let initJson;
  try {
    console.log("FlexPay init request:", {
      reference,
      paymentUrl: FLEXPAY_PAYMENT_URL,
      callbackUrl: requestBody.callbackUrl,
      phone: phoneNormalized,
      amount: requestBody.amount,
      currency: requestBody.currency,
    });
    const resp = await fetch(FLEXPAY_PAYMENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": toFlexpayBearer(FLEXPAY_TOKEN),
      },
      body: JSON.stringify(requestBody),
    });
    initJson = await resp.json();
    console.log("FlexPay init response raw:", {
      reference,
      response: initJson || null,
    });
  } catch (error) {
    console.error("FlexPay init call failed:", error);
    throw new functions.https.HttpsError(
        "unavailable",
        "FlexPay payment initiation failed.",
    );
  }

  const code = String((initJson && initJson.code) || "1");
  const orderNumber = String((initJson && initJson.orderNumber) || "");
  const message = String((initJson && initJson.message) || "");
  if (code !== "0" || !orderNumber) {
    await db.doc(`users/${ownerUid}/mobileMoneyTransactions/${reference}`).set({
      reference,
      clientUid,
      paymentAmount: String(paymentNum),
      savingsAmount: String(savingsNum),
      currency: requestBody.currency,
      phoneRaw: String(phone || ""),
      phoneNormalized,
      requestBody,
      initResponse: initJson || null,
      status: "FAILED_TO_INIT",
      createdAtMs,
      updatedAtMs: Date.now(),
      ownerUid,
      dayKey: dayKey || formatMonthDayYear(new Date()),
      paymentEntryKey:
        paymentEntryKey ||
        `${formatMonthDayYear(new Date())}-${new Date().getHours()}-${new Date().getMinutes()}-${new Date().getSeconds()}`,
      dbWriteDone: false,
    });
    await upsertMobileMoneyLookup(reference, {
      ownerUid,
      clientUid,
      orderNumber: orderNumber || null,
      status: "FAILED_TO_INIT",
      dbWriteDone: false,
      failedToInit: true,
    });
    throw new functions.https.HttpsError(
        "failed-precondition",
        `FlexPay rejected initiation: ${message || "unknown error"}`,
    );
  }

  await db.doc(`users/${ownerUid}/mobileMoneyTransactions/${reference}`).set({
    reference,
    orderNumber,
    clientUid,
    paymentAmount: String(paymentNum),
    savingsAmount: String(savingsNum),
    currency: requestBody.currency,
    phoneRaw: String(phone || ""),
    phoneNormalized,
    requestBody,
    initResponse: initJson || null,
    status: "PENDING",
    createdAtMs,
    updatedAtMs: Date.now(),
    ownerUid,
    dayKey: dayKey || formatMonthDayYear(new Date()),
    paymentEntryKey:
      paymentEntryKey ||
      `${formatMonthDayYear(new Date())}-${new Date().getHours()}-${new Date().getMinutes()}-${new Date().getSeconds()}`,
    dbWriteDone: false,
  });
  await upsertMobileMoneyLookup(reference, {
    ownerUid,
    clientUid,
    orderNumber,
    status: "PENDING",
    dbWriteDone: false,
    createdAtMs,
  });

  console.log("FlexPay init parsed:", {
    reference,
    orderNumber,
    code,
    message,
    amount: String(paymentNum),
    currency: requestBody.currency,
  });

  return {
    ok: true,
    status: "PENDING",
    reference,
    orderNumber,
    message,
  };
});

async function checkMobileMoneyPaymentInternal(ownerUid, reference) {
  if (!FLEXPAY_TOKEN) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "FlexPay token is missing on the server.",
    );
  }
  const txRef = db.doc(`users/${ownerUid}/mobileMoneyTransactions/${reference}`);
  const txSnap = await txRef.get();
  if (!txSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Transaction not found.");
  }
  const employeesSnap = await db.collection(`users/${ownerUid}/employees`).get();
  const employeeIds = employeesSnap.docs.map((d) => d.id);

  const txData = txSnap.data() || {};
  const orderNumber = String(txData.orderNumber || txData.callbackOrderNumber || "");
  const storedStatus = normalizeStatusToken(txData.status || "");
  const hasStoredTerminalStatus =
    storedStatus === "FAILED" ||
    (storedStatus === "SUCCESS" && txData.dbWriteDone === true);
  const callbackCode = String(txData.callbackCode || "");
  const callbackProviderStatus = String(txData.callbackProviderStatus || "");
  const callbackMessage = String(txData.callbackMessage || "");

  let checkJson = null;
  let checkSource = {base: "", identifier: ""};
  let code = "";
  let transaction = null;
  let providerStatus = "";
  let providerReference = null;
  let checkMessage = "";
  let providerReason = "";

  if (hasStoredTerminalStatus) {
    checkJson = txData.checkResponse || txData.callbackPayload || null;
    checkSource = {base: "callback_cache", identifier: reference};
    code = String(txData.checkCode || txData.callbackCode || (storedStatus === "SUCCESS" ? "0" : "1"));
    transaction = (checkJson && checkJson.transaction) || null;
    providerStatus = String(
        txData.providerStatus ||
        txData.callbackProviderStatus ||
        (storedStatus === "SUCCESS" ? "0" : "1"),
    );
    providerReference = txData.providerReference || txData.callbackProviderReference || null;
    checkMessage = String(txData.checkMessage || txData.callbackMessage || "");
    providerReason = String(txData.failureReason || txData.callbackFailureReason || "");
  } else {
    if (!orderNumber) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          "Missing orderNumber for this transaction.",
      );
    }
    try {
      const checked = await runFlexpayCheck(orderNumber, reference);
      checkJson = checked.json;
      checkSource = checked.source || checkSource;
    } catch (error) {
      console.error("FlexPay check call failed:", error);
      throw new functions.https.HttpsError(
          "unavailable",
          "Unable to verify transaction with FlexPay.",
      );
    }
    code = String((checkJson && checkJson.code) || "1");
    transaction = (checkJson && checkJson.transaction) || null;
    providerStatus = String((transaction && transaction.status) || "");
    providerReference =
      (transaction &&
        (transaction.provider_reference ||
          transaction.providerReference ||
          transaction.provider_ref ||
          transaction.providerRef)) ||
      checkJson.provider_reference ||
      checkJson.providerReference ||
      null;
    checkMessage = String((checkJson && checkJson.message) || "");
    providerReason = String(
        (transaction &&
          (transaction.reason ||
            transaction.statusMessage ||
            transaction.message ||
            transaction.errorMessage ||
            transaction.error)) ||
          "",
    );
  }
  const createdAtMs = toNumber(txData.createdAtMs || 0);
  const verificationAgeMs = Math.max(0, Date.now() - createdAtMs);

  let status = "PENDING";
  let capturedPendingSinceMs = null;
  let captureStableForMs = 0;
  let failureReason = "";
  if (hasStoredTerminalStatus) {
    status = storedStatus;
    capturedPendingSinceMs = toNumber(txData.capturedPendingSinceMs || 0) || null;
    failureReason = String(txData.failureReason || txData.callbackFailureReason || "");
  } else {
    const classification = classifyMobileMoneyStatus({
      code,
      providerStatus,
      providerReference,
      message: checkMessage,
      reason: providerReason,
      transactionExists: Boolean(transaction),
      callbackCode,
      callbackStatus: callbackProviderStatus,
      callbackMessage,
      previousStatus: storedStatus,
      previousCapturedPendingSinceMs: txData.capturedPendingSinceMs,
      nowMs: Date.now(),
      applyGraceWindow: true,
    });
    status = classification.status;
    capturedPendingSinceMs = classification.capturedPendingSinceMs;
    captureStableForMs = classification.captureStableForMs;
    failureReason = classification.failureReason || "";
  }

  if (!failureReason && status === "FAILED") {
    failureReason = String(providerReason || checkMessage || callbackMessage || "").trim();
  }
  console.log("FlexPay check parsed:", {
    reference,
    orderNumber,
    code,
    checkSource,
    providerStatus,
    providerReference,
    status,
    failureReason,
    verificationAgeMs,
    captureStableForMs,
    capturedPendingSinceMs,
  });

  const posted = await db.runTransaction(async (t) => {
    const latestTxSnap = await t.get(txRef);
    if (!latestTxSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Transaction missing.");
    }
    const latestTxData = latestTxSnap.data() || {};
    const nowMs = Date.now();
    const alreadyPosted = latestTxData.dbWriteDone === true;
    const checkAttempts = toNumber(latestTxData.checkAttempts || 0) + 1;
    const previousStatus = normalizeStatusToken(latestTxData.status || "");
    const statusChanged = previousStatus !== status;
    const previousTransitionAtMs = toNumber(latestTxData.lastStatusTransitionAtMs || 0);
    const normalizedCapturedPendingSinceMs = toNumber(capturedPendingSinceMs || 0);
    const nextCapturedPendingSinceMs =
      status === "CAPTURED_PENDING" ?
      (normalizedCapturedPendingSinceMs || nowMs) :
      (status === "SUCCESS" && normalizedCapturedPendingSinceMs > 0 ? normalizedCapturedPendingSinceMs : null);
    const statusUpdatePayload = {
      status,
      checkResponse: checkJson || null,
      checkSource,
      checkCode: code,
      providerStatus,
      providerReference,
      checkMessage,
      failureReason,
      checkAttempts,
      checkedAtMs: nowMs,
      updatedAtMs: nowMs,
      capturedPendingSinceMs: nextCapturedPendingSinceMs,
      lastStatusTransitionAtMs: statusChanged ? nowMs : (previousTransitionAtMs || nowMs),
    };

    if (status !== "SUCCESS" || alreadyPosted) {
      t.set(txRef, statusUpdatePayload, {merge: true});
      return false;
    }

    const clientUid = String(latestTxData.clientUid || "");
    if (!clientUid) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          "clientUid is missing in transaction.",
      );
    }

    const paymentNum = toNumber(latestTxData.paymentAmount || 0);
    const savingsNum = toNumber(latestTxData.savingsAmount || 0);
    const dayKey = String(latestTxData.dayKey || formatMonthDayYear(new Date()));
    const paymentEntryKey = String(
        latestTxData.paymentEntryKey ||
        `${formatMonthDayYear(new Date())}-${new Date().getHours()}-${new Date().getMinutes()}-${new Date().getSeconds()}`,
    );

    const clientRef = db.doc(`users/${ownerUid}/clients/${clientUid}`);
    const ownerRef = db.doc(`users/${ownerUid}`);
    const ownerStatsDailyRef = db.doc(`users/${ownerUid}/stats/dailyReimbursement`);
    const clientSnap = await t.get(clientRef);
    const ownerSnap = await t.get(ownerRef);
    const ownerStatsSnap = await t.get(ownerStatsDailyRef);
    if (!clientSnap.exists || !ownerSnap.exists) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          "Client or owner document is missing.",
      );
    }

    const clientData = clientSnap.data() || {};
    const ownerData = ownerSnap.data() || {};

    const amountPaid = toNumber(clientData.amountPaid || 0) + paymentNum;
    const amountToPay = toNumber(clientData.amountToPay || 0);
    const debtLeft = amountToPay - amountPaid;
    const numberOfPaymentsMade = toNumber(clientData.numberOfPaymentsMade || 0) + 1;
    const numberOfPaymentsMissed = Math.max(
        0,
        weeksSince(String(clientData.dateJoined || "")) - numberOfPaymentsMade,
    );
    const savings = toNumber(clientData.savings || 0) + savingsNum;
    const todayMdy = formatMonthDayYear(new Date());
    const creditScore = computeUpdatedCreditScore(
        clientData,
        paymentNum,
        debtLeft,
        todayMdy,
    );

    const clientPayload = {
      amountPaid: String(amountPaid),
      creditScore,
      numberOfPaymentsMade: String(numberOfPaymentsMade),
      numberOfPaymentsMissed: String(numberOfPaymentsMissed),
      payments: {
        [paymentEntryKey]: String(paymentNum),
      },
      paymentSources: {
        [paymentEntryKey]: "mobile_money",
      },
      debtLeft: String(debtLeft),
    };
    if (savingsNum > 0) {
      clientPayload.savings = String(savings);
      clientPayload.savingsPayments = {
        [paymentEntryKey]: String(savingsNum),
      };
    }
    const prevOwnerDailyStats = toNumber(ownerStatsSnap.exists ? ownerStatsSnap.get(dayKey) : 0);

    let finalAgentUid =
      (clientData.employee && clientData.employee.uid) ||
      clientData.agent ||
      null;
    if (finalAgentUid) {
      const assignedEmpRef = db.doc(`users/${ownerUid}/employees/${finalAgentUid}`);
      const assignedEmpSnap = await t.get(assignedEmpRef);
      if (
        !assignedEmpSnap.exists ||
        !isWorkingEmployeeForMobileMoney(assignedEmpSnap.data())
      ) {
        let foundWorking = null;
        for (const empId of employeeIds) {
          if (empId === finalAgentUid) continue;
          const empRef = db.doc(`users/${ownerUid}/employees/${empId}`);
          const empSnap = await t.get(empRef);
          if (empSnap.exists && isWorkingEmployeeForMobileMoney(empSnap.data())) {
            foundWorking = empId;
            break;
          }
        }
        finalAgentUid = foundWorking || finalAgentUid;
      }
    } else {
      for (const empId of employeeIds) {
        const empRef = db.doc(`users/${ownerUid}/employees/${empId}`);
        const empSnap = await t.get(empRef);
        if (empSnap.exists && isWorkingEmployeeForMobileMoney(empSnap.data())) {
          finalAgentUid = empId;
          break;
        }
      }
    }

    let dayTotalsRef = null;
    let ledgerRef = null;
    let nextEmployeeDayTotal = null;
    let nextEmployeeDayCount = null;
    let employeeNowMs = null;
    let employeeMonthKey = null;
    let employeeDayStartMs = null;

    if (finalAgentUid) {
      dayTotalsRef = db.doc(`users/${ownerUid}/employees/${finalAgentUid}/dayTotals/${dayKey}`);
      ledgerRef = db.collection(`users/${ownerUid}/employees/${finalAgentUid}/payments`).doc();
      const dayTotalsSnap = await t.get(dayTotalsRef);
      const prevTotal = toNumber(dayTotalsSnap.exists ? dayTotalsSnap.get("total") : 0);
      const prevCount = toNumber(dayTotalsSnap.exists ? dayTotalsSnap.get("count") : 0);
      nextEmployeeDayTotal = prevTotal + paymentNum;
      nextEmployeeDayCount = prevCount + 1;

      const now = new Date();
      employeeDayStartMs = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
      ).getTime();
      employeeNowMs = Date.now();
      employeeMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    const ownerDailyReimbursement = ownerData.dailyReimbursement || {};
    const ownerDailyMobileMoneyPayment = ownerData.dailyMobileMoneyPayment || {};
    const ownerDailySaving = ownerData.dailySaving || {};
    const dailyReimbursementValue = toNumber(ownerDailyReimbursement[dayKey]) + paymentNum;
    const dailyMobileMoneyPaymentValue = toNumber(ownerDailyMobileMoneyPayment[dayKey]) + paymentNum;
    const dailySavingValue = toNumber(ownerDailySaving[dayKey]) + savingsNum;

    t.set(txRef, statusUpdatePayload, {merge: true});
    t.set(clientRef, clientPayload, {merge: true});
    t.set(ownerStatsDailyRef, {[dayKey]: prevOwnerDailyStats + paymentNum}, {merge: true});

    if (
      finalAgentUid &&
      dayTotalsRef &&
      ledgerRef &&
      nextEmployeeDayTotal !== null &&
      nextEmployeeDayCount !== null &&
      employeeNowMs !== null &&
      employeeMonthKey &&
      employeeDayStartMs !== null
    ) {
      t.set(dayTotalsRef, {
        total: nextEmployeeDayTotal,
        count: nextEmployeeDayCount,
        dayKey,
        dayStartMs: employeeDayStartMs,
        monthKey: employeeMonthKey,
        updatedAtMs: employeeNowMs,
      }, {merge: true});

      t.set(ledgerRef, {
        amount: paymentNum,
        dayKey,
        clientUid,
        trackingId: clientData.trackingId || null,
        createdAtMs: employeeNowMs,
        savings: savingsNum || 0,
        source: "mobile_money",
        provider: "flexpay",
        reference,
        orderNumber,
      });
    }

    t.set(ownerRef, {
      clientsSavings: String(toNumber(ownerData.clientsSavings || 0) + savingsNum),
      dailyReimbursement: {
        [dayKey]: String(dailyReimbursementValue),
      },
      dailyMobileMoneyPayment: {
        [dayKey]: String(dailyMobileMoneyPaymentValue),
      },
      dailySaving: {
        [dayKey]: String(dailySavingValue),
      },
      totalDebtLeft: String(toNumber(ownerData.totalDebtLeft || 0) - paymentNum),
    }, {merge: true});

    t.set(txRef, {
      dbWriteDone: true,
      dbWriteAtMs: Date.now(),
      status: "SUCCESS",
      updatedAtMs: Date.now(),
      providerReference,
    }, {merge: true});

    return true;
  });

  await upsertMobileMoneyLookup(reference, {
    ownerUid,
    orderNumber: orderNumber || null,
    status,
    dbWriteDone: status === "SUCCESS",
    lastCheckedAtMs: Date.now(),
    checkCode: code,
    providerStatus,
    capturedPendingSinceMs: status === "CAPTURED_PENDING" ? capturedPendingSinceMs : null,
  });

  return {
    ok: true,
    status,
    posted,
    reference,
    orderNumber,
    checkSource,
    providerStatus,
    message: checkMessage,
    failureReason,
  };
}

exports.flexpayMobileMoneyCallback = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ok: false, error: "Method not allowed"});
    return;
  }

  const payload = (req.body && typeof req.body === "object") ? req.body : {};
  const reference = String(payload.reference || "").trim();
  const orderNumber = String(payload.orderNumber || "").trim();
  const callbackCode = String(payload.code || "").trim();
  const callbackMessage = String(
      payload.message ||
      payload.reason ||
      payload.statusMessage ||
      "",
  ).trim();
  const callbackProviderReference = String(
      payload.provider_reference ||
      payload.providerReference ||
      "",
  ).trim();

  console.log("FlexPay callback received:", {
    reference,
    orderNumber,
    code: callbackCode,
    message: callbackMessage,
    providerReference: callbackProviderReference,
    payload,
  });

  if (!reference) {
    res.status(400).json({ok: false, error: "reference is required"});
    return;
  }

  const normalizedCallbackStatus = normalizeStatusToken(payload.status || "");
  let callbackObservedStatus = "PENDING";
  if (callbackCode && callbackCode !== "0") {
    callbackObservedStatus = "FAILED";
  } else if (FAILURE_STATUS_TOKENS.has(normalizedCallbackStatus)) {
    callbackObservedStatus = "FAILED";
  } else if (
    SUCCESS_STATUS_TOKENS.has(normalizedCallbackStatus) ||
    (
      callbackCode === "0" &&
      normalizedCallbackStatus.length > 0 &&
      !PENDING_STATUS_TOKENS.has(normalizedCallbackStatus)
    )
  ) {
    callbackObservedStatus = "SUCCESS";
  }

  const lookupSnap = await db.doc(`${MOBILE_MONEY_LOOKUP_COLLECTION}/${reference}`).get();
  const ownerUid = String((lookupSnap.exists && lookupSnap.get("ownerUid")) || "");
  if (!ownerUid) {
    console.error("FlexPay callback owner lookup missing:", {reference, orderNumber});
    res.status(202).json({ok: true, acknowledged: true, status: "LOOKUP_MISSING"});
    return;
  }

  const txRef = db.doc(`users/${ownerUid}/mobileMoneyTransactions/${reference}`);
  await txRef.set({
    callbackPayload: payload,
    callbackCode,
    callbackMessage,
    callbackProviderReference: callbackProviderReference || null,
    callbackOrderNumber: orderNumber || null,
    callbackProviderStatus: String(payload.status || "").trim(),
    callbackObservedStatus,
    callbackFailureReason: callbackObservedStatus === "FAILED" ? callbackMessage : "",
    callbackReceivedAtMs: Date.now(),
    updatedAtMs: Date.now(),
  }, {merge: true});

  await upsertMobileMoneyLookup(reference, {
    ownerUid,
    orderNumber: orderNumber || (lookupSnap.exists ? lookupSnap.get("orderNumber") || null : null),
    callbackReceivedAtMs: Date.now(),
    callbackCode,
    callbackMessage,
    callbackObservedStatus,
  });

  let posted = false;
  let finalStatus = callbackObservedStatus;
  try {
    const settled = await checkMobileMoneyPaymentInternal(ownerUid, reference);
    posted = Boolean(settled && settled.posted);
    finalStatus = settled && settled.status ? settled.status : finalStatus;
  } catch (error) {
    console.error("FlexPay callback settlement failed:", {
      reference,
      ownerUid,
      message: error && error.message ? error.message : String(error),
    });
  }

  try {
    if (finalStatus === "SUCCESS" || finalStatus === "FAILED") {
      await notifyWhatsAppPaymentResult(reference, ownerUid, finalStatus);
    }
  } catch (waErr) {
    console.error("WhatsApp payment notification error:", waErr);
  }

  res.status(200).json({
    ok: true,
    acknowledged: true,
    reference,
    orderNumber,
    status: finalStatus,
    posted,
  });
});

exports.checkMobileMoneyPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }
  const ownerUid = context.auth.uid;
  const {reference} = data || {};
  if (!reference) {
    throw new functions.https.HttpsError("invalid-argument", "reference is required.");
  }
  return checkMobileMoneyPaymentInternal(ownerUid, reference);
});

exports.reconcilePendingMobileMoneyPayments = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
      let scanned = 0;
      let settled = 0;
      let stillPending = 0;
      let failed = 0;
      let errors = 0;

      const pendingSnap = await db
          .collection(MOBILE_MONEY_LOOKUP_COLLECTION)
          .where("status", "in", ["PENDING", "CAPTURED_PENDING"])
          .limit(50)
          .get();

      for (const doc of pendingSnap.docs) {
        scanned += 1;
        const ownerUid = String(doc.get("ownerUid") || "");
        const reference = doc.id;

        if (!ownerUid || !reference) {
          errors += 1;
          continue;
        }

        try {
          const result = await checkMobileMoneyPaymentInternal(ownerUid, reference);
          if (result.status === "SUCCESS") {
            settled += 1;
          } else if (result.status === "FAILED") {
            failed += 1;
          } else {
            stillPending += 1;
          }
        } catch (error) {
          errors += 1;
          console.error("reconcilePendingMobileMoneyPayments error:", {
            ownerUid,
            reference,
            message: error && error.message ? error.message : String(error),
          });
        }
      }

      console.log("reconcilePendingMobileMoneyPayments summary:", {
        scanned,
        settled,
        failed,
        stillPending,
        errors,
      });
      return null;
    });

/**
 * Callable: record a summary entry for a bulk or custom messaging action.
 */
exports.recordBulkMessageLog = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication is required to record logs.",
    );
  }

  const {
    type = "custom",
    total,
    succeeded,
    failed,
    locationTotals = {},
    template = "",
    messagePreview = "",
    conditionSummary = "",
    sentBy,
    sentById,
  } = data || {};

  if (
    typeof total !== "number" ||
    typeof succeeded !== "number" ||
    typeof failed !== "number"
  ) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "total, succeeded and failed must be numbers.",
    );
  }

  const sanitizedTotals = {};
  if (locationTotals && typeof locationTotals === "object") {
    Object.entries(locationTotals).forEach(([rawName, rawCount]) => {
      const label =
        (rawName && String(rawName).trim()) || "Sans localisation";
      const count = Number(rawCount) || 0;
      if (count > 0) sanitizedTotals[label] = count;
    });
  }

  const now = Date.now();
  const authInfo = context.auth;
  const authToken = (authInfo && authInfo.token) || {};

  await db.collection("bulk_message_logs").add({
    type,
    total,
    succeeded,
    failed,
    locationTotals: sanitizedTotals,
    template,
    messagePreview,
    conditionSummary: conditionSummary || null,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentAtMs: now,
    sentBy: sentBy || authToken.name || authToken.email || null,
    sentById: sentById || authInfo.uid || null,
  });

  return {ok: true};
});

/**
 * Callable: schedule a bulk SMS send with a Kinshasa local time.
 */
exports.scheduleBulkMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication is required to schedule messages.",
    );
  }

  const {
    type = "custom",
    template = "",
    messagePreview = "",
    locationTotals = {},
    conditionSummary = "",
    scheduledForLocal,
    timeZone = KINSHASA_TIME_ZONE,
    recipients = [],
    sentBy,
    sentById,
  } = data || {};

  if (!scheduledForLocal) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "scheduledForLocal is required.",
    );
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "recipients must be a non-empty array.",
    );
  }

  const scheduledForMs = zonedTimeToUtcMs(scheduledForLocal, timeZone);
  if (!Number.isFinite(scheduledForMs)) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid scheduled date/time.",
    );
  }

  const sanitizedTotals = {};
  if (locationTotals && typeof locationTotals === "object") {
    Object.entries(locationTotals).forEach(([rawName, rawCount]) => {
      const label =
        (rawName && String(rawName).trim()) || "Sans localisation";
      const count = Number(rawCount) || 0;
      if (count > 0) sanitizedTotals[label] = count;
    });
  }

  const now = Date.now();
  const docRef = db.collection("scheduled_bulk_messages").doc();
  const authInfo = context.auth;
  const authToken = (authInfo && authInfo.token) || {};

  await docRef.set({
    status: "scheduled",
    type,
    template,
    messagePreview,
    locationTotals: sanitizedTotals,
    conditionSummary: conditionSummary || null,
    scheduledForLocal,
    scheduledForMs,
    timeZone,
    total: recipients.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: now,
    createdBy: sentBy || authToken.name || authToken.email || null,
    createdById: sentById || authInfo.uid || null,
  });

  const batches = [];
  let batch = db.batch();
  let ops = 0;

  recipients.forEach((recipient) => {
    const ref = docRef.collection("recipients").doc();
    batch.set(ref, {
      phoneNumber: recipient.phoneNumber || null,
      message: recipient.message || "",
    });
    ops += 1;
    if (ops === 450) {
      batches.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  });

  if (ops > 0) batches.push(batch.commit());
  await Promise.all(batches);

  return {ok: true, id: docRef.id};
});

/**
 * Callable: cancel a scheduled bulk message.
 */
exports.cancelScheduledBulkMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication is required to cancel scheduling.",
    );
  }

  const {scheduleId} = data || {};
  if (!scheduleId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "scheduleId is required.",
    );
  }

  const ref = db.collection("scheduled_bulk_messages").doc(scheduleId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Schedule not found.");
  }
  const current = snap.data() || {};
  if (current.status !== "scheduled") {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "Only scheduled messages can be canceled.",
    );
  }

  const recipientsSnap = await ref.collection("recipients").get();
  const batches = [];
  let batch = db.batch();
  let ops = 0;

  recipientsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    ops += 1;
    if (ops === 450) {
      batches.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  });

  if (ops > 0) batches.push(batch.commit());
  await Promise.all(batches);
  await ref.delete();

  return {ok: true};
});

/**
 * Callable: delete a scheduled bulk message record (including recipients).
 */
exports.deleteScheduledBulkMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication is required to delete scheduling.",
    );
  }

  const {scheduleId} = data || {};
  if (!scheduleId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "scheduleId is required.",
    );
  }

  const ref = db.collection("scheduled_bulk_messages").doc(scheduleId);
  const recipientsSnap = await ref.collection("recipients").get();
  const batches = [];
  let batch = db.batch();
  let ops = 0;

  recipientsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    ops += 1;
    if (ops === 450) {
      batches.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  });

  if (ops > 0) batches.push(batch.commit());
  await Promise.all(batches);
  await ref.delete();

  return {ok: true};
});

/**
 * Scheduled: deliver due bulk messages and write logs.
 */
exports.processScheduledBulkMessages = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
      const now = Date.now();
      const maxClaims = 3;
      const pageSize = 25;
      const maxScan = 200;
      let claimedCount = 0;
      let scannedCount = 0;
      let lastDoc = null;

      while (claimedCount < maxClaims && scannedCount < maxScan) {
        let query = db
            .collection("scheduled_bulk_messages")
            .where("scheduledForMs", "<=", now)
            .orderBy("scheduledForMs", "asc")
            .limit(pageSize);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const dueSnap = await query.get();
        if (dueSnap.empty) break;

        for (const doc of dueSnap.docs) {
          lastDoc = doc;
          scannedCount += 1;
          const ref = doc.ref;
          const preData = doc.data() || {};
          if (preData.status !== "scheduled") continue;
          let claimed = false;
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const current = snap.data() || {};
            if (current.status !== "scheduled") return;
            tx.update(ref, {
              status: "processing",
              processingAt: admin.firestore.FieldValue.serverTimestamp(),
              processingAtMs: Date.now(),
            });
            claimed = true;
          });
          if (!claimed) continue;

          const data = preData;
          const recipientsSnap = await ref.collection("recipients").get();
          let succeeded = 0;
          let failed = 0;

          for (const recipient of recipientsSnap.docs) {
            const {phoneNumber, message} = recipient.data() || {};
            const to = makeValidE164(phoneNumber);
            if (!to || !message) {
              failed += 1;
              continue;
            }
            try {
              await sms.send({to: [to], message});
              succeeded += 1;
            } catch (err) {
              console.error("Scheduled SMS send failed:", err);
              failed += 1;
            }
          }

          await ref.update({
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            sentAtMs: Date.now(),
            succeeded,
            failed,
          });

          await db.collection("bulk_message_logs").add({
            type: data.type || "custom",
            total: data.total || recipientsSnap.size,
            succeeded,
            failed,
            locationTotals: data.locationTotals || {},
            template: data.template || "",
            messagePreview: data.messagePreview || "",
            conditionSummary: data.conditionSummary || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            sentAtMs: Date.now(),
            sentBy: data.createdBy || null,
            sentById: data.createdById || null,
          });

          claimedCount += 1;
          if (claimedCount >= maxClaims) break;
        }

        if (dueSnap.size < pageSize) break;
      }
    });

/**
 * Helper function to format a date string to DD/MM/YYYY
 */
function formatDate(dateInput) {
  const date = new Date(dateInput);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Cloud Function to send SMS when a client's loan is activated.
 */
exports.sendClientCompletionSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onUpdate(async (change, context) => {
      console.log("sendClientCompletionSMS function execution started");

      const beforeData = change.before.data();
      const afterData = change.after.data();

      const oldCycleStart = beforeData.debtCycleStartDate;
      const newCycleStart = afterData.debtCycleStartDate;

      console.log("Old cycle start date:", oldCycleStart);
      console.log("New cycle start date:", newCycleStart);

      // Only proceed if the debtCycleStartDate actually changed
      if (oldCycleStart !== newCycleStart) {
        console.log("Debt cycle start date changed. Proceeding to send SMS.");

        // Retrieve necessary fields
        const montant = afterData.loanAmount || "N/A";

        // For safety, always handle possibility of a missing date
        const dateDebut = newCycleStart ? formatDate(newCycleStart) : "N/A";
        const dateFin = afterData.debtCycleEndDate ?
        formatDate(afterData.debtCycleEndDate) :
        "N/A";
        const nombrePaiements = afterData.paymentPeriodRange || "N/A";

        const duree = afterData.paymentPeriodRange ?
        `${afterData.paymentPeriodRange} semaines` :
        "N/A";

        // Compute minimum payment
        let montantMinimum = "N/A";
        const amountToPay = parseFloat(afterData.amountToPay);
        const paymentPeriodRange = parseInt(afterData.paymentPeriodRange, 10);
        if (!isNaN(amountToPay) && !isNaN(paymentPeriodRange) && paymentPeriodRange > 0) {
          montantMinimum = (amountToPay / paymentPeriodRange).toFixed(2);
        }

        // Retrieve client details
        const firstName = afterData.firstName || "";
        const lastName = afterData.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || "Valued Client";
        const phoneNumber = afterData.phoneNumber;

        if (!phoneNumber) {
          console.log("Client does not have a phone number.");
          return null;
        }

        const formattedNumber = makeValidE164(phoneNumber);
        if (!formattedNumber) {
          console.log(`Invalid phone number format: ${phoneNumber}`);
          return null;
        }

        console.log(`Formatted phone number: ${formattedNumber}`);

        // Construct your message
        const message = `${fullName},
Ozui Niongo ya ${montant} FC. Efuteli Ekobanda le ${dateDebut} pe ekosila le ${dateFin}. Okosala ${nombrePaiements} paiements na ${duree}, okofuta ${montantMinimum} FC semaine nionso. Félicitations na confiance ya kozala membre ya Fondation Gervais. Soki ofuti crédit nayo bien ba avantages eza ebele. Soki mituna ezali benga 0825333567. Merci pona confiance na FONDATION GERVAIS`;

        console.log(`Constructed message: ${message}`);

        try {
          const response = await sms.send({
            to: [formattedNumber],
            message: message,
          });
          console.log(`SMS sent to ${formattedNumber}:`, response);
        } catch (error) {
          console.error("Error sending SMS via Africa's Talking:", error);
        }
      } else {
        console.log("Debt cycle start date did NOT change. Exiting function.");
      }

      console.log("sendClientCompletionSMS function execution completed");
      return null;
    });


/**
 * Cloud Function to send reminders to all clients passed in from the front end.
 *
 * Triggered via HTTPS Callable:
 *   const callable = this.fns.httpsCallable('sendPaymentReminders');
 *   callable({ clients: [...] });
 */
exports.sendPaymentReminders = functions.https.onCall(async (data, context) => {
  const {clients} = data;

  if (!clients || !Array.isArray(clients)) {
    console.error("No client array provided");
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Expected clients array",
    );
  }

  // Optionally, you can check if the caller is authenticated:
  // if (!context.auth) {
  //   throw new functions.https.HttpsError(
  //     'unauthenticated',
  //     'Only authenticated users can invoke this function.'
  //   );
  // }

  let successCount = 0;
  let failCount = 0;

  // Iterate through each client, format phone, build message, and send
  for (const client of clients) {
    const {firstName, lastName, phoneNumber, minPayment, debtLeft, savings} = client;
    if (!phoneNumber) {
      console.log("Skipping client with no phone number:", client);
      failCount++;
      continue;
    }

    const formattedNumber = makeValidE164(phoneNumber);
    if (!formattedNumber) {
      console.log(`Invalid phone number: ${phoneNumber}`);
      failCount++;
      continue;
    }

    // Construct your reminder message
    // You can adjust the wording as you wish
    const message = `Bonjour ${firstName || "Valued"} ${
      lastName || "Client"
    },\n` +
    `Ozali programmer lelo pona kofuta  FC ${minPayment}. Otikali na niongo ya FC ${debtLeft}. Epargnes na yo ezali: FC ${savings}.\n` +
    `Merci pona confiance na FONDATION GERVAIS.`;

    try {
      // Send SMS via Africa's Talking
      const response = await sms.send({
        to: [formattedNumber],
        message,
      });
      console.log(`SMS sent to ${formattedNumber} ->`, response);
      successCount++;
    } catch (error) {
      console.error("Error sending SMS:", error);
      failCount++;
    }
  }

  // Return an object so the client knows how many succeeded/failed
  return {
    message: `Reminders sent. Success: ${successCount}, Failed: ${failCount}`,
  };
});


function generate4DigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Cloud Function (callable) that:
 * 1) Receives { phoneNumber, name? } from client
 * 2) Generates a 4-digit code
 * 3) Sends the code via SMS ("<code> ezali code na yo")
 * 4) Optionally returns (or stores) the code for verification
 */
exports.sendVerificationCode = functions.https.onCall(async (data, context) => {
  const phoneNumber = data.phoneNumber;
  // const name = data.name || "Cher Client";

  if (!phoneNumber) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "phoneNumber is required",
    );
  }

  // Format phone number
  const formattedPhone = makeValidE164(phoneNumber);
  if (!formattedPhone) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Could not format phone number",
    );
  }

  // Generate the 4-digit code
  const code = generate4DigitCode();

  // Construct your message in Lingala or French as you prefer
  const message = `${code} ezali code na yo - FONDATION GERVAIS.`;

  console.log(`Sending code '${code}' to phone: ${formattedPhone}`);

  // Send SMS
  try {
    const response = await sms.send({
      to: [formattedPhone],
      message: message,
    });
    console.log("SMS send response:", response);
  } catch (error) {
    console.error("Error sending SMS via Africa's Talking:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Failed to send SMS. " + error.message,
    );
  }

  // Optionally store the code in Firestore (if you want verification)
  // Example: store in a subcollection "otpCodes" under the user's doc
  /*
  await admin.firestore().collection("otpCodes").add({
    phoneNumber: formattedPhone,
    code: code,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  */

  // Return the code if you need it client-side or for debugging
  return {
    message: `Verification code sent to ${formattedPhone}`,
    code: code,
  };
});


exports.sendClientRegistrationSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onWrite(async (change, context) => {
    // Exit if the document is deleted
      if (!change.after.exists) {
        console.log("Document was deleted. Exiting...");
        return null;
      }
      const beforeData = change.before.data() || {};
      const afterData = change.after.data() || {};

      // Check if we have *transitioned* to the register state
      const wasRegister = isRegisterState(beforeData);
      const isRegister = isRegisterState(afterData);

      if (!isRegister) {
        // Not in registration state after the update => do nothing
        console.log("Not a registration state. Exiting...");
        return null;
      }

      if (wasRegister && isRegister) {
        // Already was in registration state => no change => do nothing
        console.log("Already in registration state, no change. Exiting...");
        return null;
      }

      // ---- If we reach here, we *just* transitioned to 'register' state ----
      console.log("Client transitioned to registration state. Proceeding with SMS...");


      // ---- Gather necessary fields ----
      const firstName = afterData.firstName || "";
      const lastName = afterData.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || "Valued Client";

      const phoneNumber = afterData.phoneNumber;
      if (!phoneNumber) {
        console.log("No phone number found for this client. Skipping SMS...");
        return null;
      }

      // Validate or convert phone number to E.164 (if needed)
      const formattedNumber = makeValidE164(phoneNumber);
      if (!formattedNumber) {
        console.log(`Invalid phone number format: ${phoneNumber}`);
        return null;
      }

      // Summation of fees: membership + application
      const membershipFee = Number(afterData.membershipFee || 0);
      const applicationFee = Number(afterData.applicationFee || 0);
      const frais = membershipFee + applicationFee;

      // The total loan amount
      const montant = afterData.loanAmount || "N/A";

      // Savings (already updated in your app when they register)
      const savings = afterData.savings || 0;

      // requestDate is stored in MM-DD-YYYY, but you want DD/MM/YYYY
      const requestDateRaw = afterData.requestDate; // e.g. "3-18-2025"
      const requestDate = formatDate(requestDateRaw);

      // ---- Construct your SMS message ----
      // Example in Lingala (based on your snippet):
      const message = `${fullName},
Osengi niongo ya ${montant} FC. Niongo okozua yango le ${requestDate}.
Ofuti mobongo ya frais nionso ${frais} FC. Epargnes na yo otie ezali ${savings} FC.
En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.
Merci pona confiance na FONDATION GERVAIS`;

      console.log("Registration SMS message:", message);
      console.log("Sending to:", formattedNumber);

      // ---- Send the SMS using your Africa's Talking (or other) SDK ----
      try {
        const response = await sms.send({
          to: [formattedNumber],
          message: message,
        });
        console.log(`SMS sent to ${formattedNumber}:`, response);
      } catch (error) {
        console.error("Error sending registration SMS:", error);
      }

      // -----------------------------------------------------------------
      //   PART 2: Assign the client to an auditor & send the auditor SMS
      // -----------------------------------------------------------------

      try {
      // 1) Fetch the user doc to get the user’s firstName as "clientLocation"
        const userDocSnapshot = await db
            .collection("users")
            .doc(context.params.userId)
            .get();
        const userData = userDocSnapshot.data() || {};
        const clientLocation = userData.firstName || "Unknown";

        if (userData.mode==="testing") {
          console.log("User is in testing mode. Skipping auditor assignment...");
          return null;
        }
        // 2) Fetch all audit documents
        const auditsSnapshot = await db.collection("audit").get();
        if (auditsSnapshot.empty) {
          console.log("No auditors found. Skipping assignment...");
          return null;
        }

        // 3) Find the auditor with the fewest pendingClients
        let chosenAudit = null;
        let minClients = Infinity;
        let backupAudits = []; // In case multiple have the same #, we can pick randomly

        auditsSnapshot.forEach((doc) => {
          const data = doc.data();
          const pendingClients = data.pendingClients || [];
          const size = pendingClients.length;

          if (size < minClients) {
            chosenAudit = {id: doc.id, ...data};
            minClients = size;
            backupAudits = [chosenAudit];
          } else if (size === minClients) {
          // track multiple if needed
            backupAudits.push({id: doc.id, ...data});
          }
        });

        // If we have multiple audits tied, pick randomly from backupAudits
        if (backupAudits.length > 1) {
          const idx = Math.floor(Math.random() * backupAudits.length);
          chosenAudit = backupAudits[idx];
        }

        if (!chosenAudit) {
          console.log("No suitable auditor found. Skipping assignment...");
          return null;
        }

        console.log("Chosen auditor:", chosenAudit.name);

        // 4) Add this client to the chosen auditor's pendingClients array
        await db
            .collection("audit")
            .doc(chosenAudit.id)
            .update({
              pendingClients: admin.firestore.FieldValue.arrayUnion({
                clientName: fullName,
                clientLocation: clientLocation,
                clientPhoneNumber: phoneNumber,
                clientId: context.params.clientId,
                clientProfilePicture: afterData.profilePicture.downloadURL || "",
              }),
            });

        // 5) Send SMS to the chosen auditor
        const auditorNumber = makeValidE164(chosenAudit.phoneNumber);
        if (!auditorNumber) {
          console.log(`Invalid phone number for auditor: ${chosenAudit.phoneNumber}`);
        } else {
        // Construct the auditor SMS
          const auditorMessage = `${chosenAudit.name},
Oponami pona ko verifier ba information ya client ${fullName} ya location ${clientLocation}. Numero na ye ezali ${phoneNumber}. Benga ye pe verifier ba information na ye. Merci pona mosala malamu na FONDATION GERVAIS`;

          try {
            const response = await sms.send({
              to: [auditorNumber],
              message: auditorMessage,
            });
            console.log(`SMS sent to auditor ${auditorNumber}:`, response);
          } catch (error) {
            console.error("Error sending auditor SMS:", error);
          }
        }
      } catch (error) {
        console.error("Error during auditor assignment:", error);
      }

      return null;
    });

function isRegisterState(data) {
  return (
    data.type === "register" &&
        data.requestStatus === "pending" &&
        data.requestType === "lending"
  );
}


// Utility: convert "MM-DD-YYYY" to "YYYY/MM/DD" for JS Date()
function convertToDateCompatibleFormat(dateStr) {
  const [month, day, year] = dateStr.split("-");
  return `${year}/${month}/${day}`;
}

/**
 * didClientStartThisWeek(client)
 * Returns false if client started their debt cycle in the last 6 days
 * (meaning 'debtCycleStartDate' is > oneWeekAgo).
 */
function didClientStartThisWeek(client) {
  if (!client.debtCycleStartDate) {
    // If missing, decide your default. We'll assume "true" so they won't be filtered out.
    return true;
  }

  const oneWeekAgo = new Date();
  // Subtract 6 days
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

  const formatted = convertToDateCompatibleFormat(client.debtCycleStartDate);
  const debtCycleStartDate = new Date(formatted);

  // If they started more recently than oneWeekAgo => false
  if (debtCycleStartDate > oneWeekAgo) {
    return false;
  }
  return true;
}

/**
 * findClientsWithDebtsIncludingThoseWhoLeft
 * Returns only clients where debtLeft > 0
 */
function findClientsWithDebtsIncludingThoseWhoLeft(clients) {
  if (!Array.isArray(clients)) return [];
  return clients.filter((c) => Number(c.debtLeft) > 0);
}

/**
 * minimumPayment(client)
 * If the remaining debt (debtLeft) is less than the "standard" min payment,
 * we only ask for the remaining debt. Otherwise, ask for pay = amountToPay / paymentPeriodRange.
 */
function minimumPayment(client) {
  const pay = Number(client.amountToPay) / Number(client.paymentPeriodRange);

  if (
    client.debtLeft &&
    Number(client.debtLeft) > 0 &&
    Number(client.debtLeft) < pay
  ) {
    // Use the leftover debt as the min payment
    return Number(client.debtLeft);
  }

  // Otherwise, the normal min
  return pay; // can return as number or string, but let's keep it numeric for clarity
}


/**
 * SCHEDULED FUNCTION:
 * Runs daily at 08:00 Africa/Kinshasa Time
 * Fetches all users except mode="testing", collects clients,
 * filters them, calculates minPayment, and sends SMS reminders
 */
exports.scheduledSendReminders = functions.pubsub
    .schedule("0 8 * * *")
    .timeZone("Africa/Kinshasa")
    .onRun(async (context) => {
      console.log("===> Starting scheduledSendReminders at 8AM Kinshasa time...");

      try {
      // 1. Identify today's weekday => "Monday", "Tuesday", etc.
        const theDay = new Date().toLocaleString("en-US", {weekday: "long"});
        console.log("===> Today is:", theDay);

        // 2. Fetch all users except those with mode="testing"
        const usersSnapshot = await admin
            .firestore()
            .collection("users")
            .where("mode", "!=", "testing")
            .get();

        if (usersSnapshot.empty) {
          console.log("No users found (excl. mode='testing'). Exiting...");
          return null;
        }

        // 3. For each user, get sub-collection "clients"
        const allClients = [];
        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;

          const clientSnapshot = await admin
              .firestore()
              .collection("users")
              .doc(userId)
              .collection("clients")
              .get();

          if (!clientSnapshot.empty) {
            clientSnapshot.forEach((cDoc) => {
            // Add doc data to allClients array
              allClients.push({
                ...cDoc.data(),
                docId: cDoc.id,
                userId,
              });
            });
          }
        }

        if (allClients.length === 0) {
          console.log("No clients found across all non-testing users. Exiting...");
          return null;
        }

        // 4. Filter to only those with debts
        const clientsWithDebts = findClientsWithDebtsIncludingThoseWhoLeft(allClients);

        // 5. Filter by paymentDay, isPhoneCorrect, and didClientStartThisWeek
        const clientsToRemind = clientsWithDebts.filter((client) => {
          return (
            client.paymentDay === theDay &&
          client.isPhoneCorrect !== "false" &&
          didClientStartThisWeek(client)
          );
        });

        if (clientsToRemind.length === 0) {
          console.log("No clients need reminders today after filtering. Exiting...");
          return null;
        }

        // 6. Send SMS to each valid client
        let successCount = 0;
        let failCount = 0;

        for (const client of clientsToRemind) {
          const {
            firstName,
            lastName,
            phoneNumber,
            debtLeft,
            savings,
            debtCycleEndDate,
            requestNotTosend,
          } = client;

          // Calculate minPayment with your logic
          //   amountToPay / paymentPeriodRange
          //   or leftover debt if smaller
          const minPay = minimumPayment(client);

          // Format phone
          if (!phoneNumber) {
            console.log("Skipping client with no phone number:", client);
            failCount++;
            continue;
          }
          const formattedNumber = makeValidE164(phoneNumber);
          if (!formattedNumber) {
            console.log(`Skipping invalid phone number: ${phoneNumber}`);
            failCount++;
            continue;
          }

          // Check if client is late (debtCycleEndDate is before today)
          let isLate = false;
          if (debtCycleEndDate) {
            try {
              // Parse debtCycleEndDate (format: M-D-YYYY or MM-DD-YYYY)
              const parts = debtCycleEndDate.split("-");
              if (parts.length === 3) {
                const month = Number(parts[0]);
                const day = Number(parts[1]);
                const year = Number(parts[2]);

                // Validate parsed values
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                  const debtEndDate = new Date(year, month - 1, day);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  debtEndDate.setHours(0, 0, 0, 0);

                  // If debt end date is before today, client is late
                  if (debtEndDate < today) {
                    isLate = true;
                    console.log(`Client ${firstName} ${lastName} is LATE. debtCycleEndDate: ${debtCycleEndDate}, parsed: ${debtEndDate.toISOString()}, today: ${today.toISOString()}`);
                  } else {
                    console.log(`Client ${firstName} ${lastName} is NOT late. debtCycleEndDate: ${debtCycleEndDate}, parsed: ${debtEndDate.toISOString()}, today: ${today.toISOString()}`);
                  }
                } else {
                  console.log(`Invalid date format for client ${firstName} ${lastName}: ${debtCycleEndDate}`);
                }
              } else {
                console.log(`Invalid date format (wrong number of parts) for client ${firstName} ${lastName}: ${debtCycleEndDate}`);
              }
            } catch (error) {
              console.error(`Error parsing debtCycleEndDate for client ${firstName} ${lastName}: ${debtCycleEndDate}`, error);
            }
          } else {
            console.log(`No debtCycleEndDate for client ${firstName} ${lastName}`);
          }

          // Filter out clients who requested not to send, UNLESS they are late
          // If client is not late and has requestNotTosend === 'true', skip them
          // IMPORTANT: If client is late, ALWAYS send message regardless of requestNotTosend
          if (!isLate && requestNotTosend === "true") {
            console.log(`Skipping client ${firstName} ${lastName} - requested not to send and NOT late (deadline: ${debtCycleEndDate || "N/A"})`);
            continue;
          }

          // Log if sending to a late client who requested not to send
          if (isLate && requestNotTosend === "true") {
            console.log(`Sending to LATE client ${firstName} ${lastName} despite requestNotTosend=true (deadline passed: ${debtCycleEndDate})`);
          }

          // Construct your reminder message
          let message = `Bonjour ${firstName || "Valued"} ${
            lastName || "Client"
          },\n` +
          `Ozali programmer lelo pona kofuta ${minPay} FC. ` +
          `Otikali na niongo ya ${debtLeft} FC. ` +
          `Epargnes na yo ezali: ${savings}FC.\n`;

          // Add late payment message if client is late
          // (This will be sent even if requestNotTosend is true)
          if (isLate) {
            message += `Ozali na retard makasi Mpenza. Kende Kofuta niongo.\n`;
          }

          message += `En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.`+
          `Merci pona confiance na FONDATION GERVAIS.`;

          try {
          // Send SMS via Africa's Talking
            const response = await sms.send({
              to: [formattedNumber],
              message,
            });
            // console.log(`SMS sent to ${formattedNumber} =>`, message);
            console.log(`SMS sent to ${formattedNumber} =>`, response);
            successCount++;
          } catch (error) {
            console.error(`Error sending SMS to ${formattedNumber}:`, error);
            failCount++;
          }
        }

        console.log(
            `===> Reminders done. Success: ${successCount}, Failed: ${failCount}`,
        );
        return null;
      } catch (error) {
        console.error("Error in scheduledSendReminders:", error);
        throw error; // Let Firebase log it as a function error
      }
    });

/*
 * SCHEDULED FUNCTION (TESTING):
 * Runs daily at 18:30 (6:30 PM) America/Los_Angeles Time (Las Vegas)
 * Fetches all users with mode="testing", collects clients,
 * filters them, calculates minPayment, and sends SMS reminders
 *
 * COMMENTED OUT - Can be uncommented when needed for testing
 */
/*
exports.scheduledSendRemindersTesting = functions.pubsub
    .schedule("25 19 * * *")
    .timeZone("America/Los_Angeles")
    .onRun(async (context) => {
      console.log("===> Starting scheduledSendRemindersTesting at 6:30 PM Las Vegas time...");

      try {
      // 1. Identify today's weekday => "Monday", "Tuesday", etc.
        const theDay = new Date().toLocaleString("en-US", {weekday: "long"});
        console.log("===> Today is:", theDay);

        // 2. Fetch all users with mode="testing"
        const usersSnapshot = await admin
            .firestore()
            .collection("users")
            .where("mode", "==", "testing")
            .get();

        if (usersSnapshot.empty) {
          console.log("No users found with mode='testing'. Exiting...");
          return null;
        }

        // 3. For each user, get sub-collection "clients"
        const allClients = [];
        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;

          const clientSnapshot = await admin
              .firestore()
              .collection("users")
              .doc(userId)
              .collection("clients")
              .get();

          if (!clientSnapshot.empty) {
            clientSnapshot.forEach((cDoc) => {
            // Add doc data to allClients array
              allClients.push({
                ...cDoc.data(),
                docId: cDoc.id,
                userId,
              });
            });
          }
        }

        if (allClients.length === 0) {
          console.log("No clients found across all testing users. Exiting...");
          return null;
        }

        // 4. Filter to only those with debts
        const clientsWithDebts = findClientsWithDebtsIncludingThoseWhoLeft(allClients);

        // 5. Filter by paymentDay, isPhoneCorrect, and didClientStartThisWeek
        const clientsToRemind = clientsWithDebts.filter((client) => {
          return (
            client.paymentDay === theDay &&
          client.isPhoneCorrect !== "false" &&
          didClientStartThisWeek(client)
          );
        });

        if (clientsToRemind.length === 0) {
          console.log("No clients need reminders today after filtering. Exiting...");
          return null;
        }

        // 6. Send SMS to each valid client
        let successCount = 0;
        let failCount = 0;

        for (const client of clientsToRemind) {
          const {
            firstName,
            lastName,
            phoneNumber,
            debtLeft,
            savings,
            debtCycleEndDate,
            requestNotTosend,
          } = client;

          // Calculate minPayment with your logic
          //   amountToPay / paymentPeriodRange
          //   or leftover debt if smaller
          const minPay = minimumPayment(client);

          // Format phone
          if (!phoneNumber) {
            console.log("Skipping client with no phone number:", client);
            failCount++;
            continue;
          }
          const formattedNumber = makeValidE164(phoneNumber);
          if (!formattedNumber) {
            console.log(`Skipping invalid phone number: ${phoneNumber}`);
            failCount++;
            continue;
          }

          // Check if client is late (debtCycleEndDate is before today)
          let isLate = false;
          if (debtCycleEndDate) {
            try {
              // Parse debtCycleEndDate (format: M-D-YYYY or MM-DD-YYYY)
              const parts = debtCycleEndDate.split("-");
              if (parts.length === 3) {
                const month = Number(parts[0]);
                const day = Number(parts[1]);
                const year = Number(parts[2]);

                // Validate parsed values
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                  const debtEndDate = new Date(year, month - 1, day);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  debtEndDate.setHours(0, 0, 0, 0);

                  // If debt end date is before today, client is late
                  if (debtEndDate < today) {
                    isLate = true;
                    console.log(`Client ${firstName} ${lastName} is LATE. debtCycleEndDate: ${debtCycleEndDate}, parsed: ${debtEndDate.toISOString()}, today: ${today.toISOString()}`);
                  } else {
                    console.log(`Client ${firstName} ${lastName} is NOT late. debtCycleEndDate: ${debtCycleEndDate}, parsed: ${debtEndDate.toISOString()}, today: ${today.toISOString()}`);
                  }
                } else {
                  console.log(`Invalid date format for client ${firstName} ${lastName}: ${debtCycleEndDate}`);
                }
              } else {
                console.log(`Invalid date format (wrong number of parts) for client ${firstName} ${lastName}: ${debtCycleEndDate}`);
              }
            } catch (error) {
              console.error(`Error parsing debtCycleEndDate for client ${firstName} ${lastName}: ${debtCycleEndDate}`, error);
            }
          } else {
            console.log(`No debtCycleEndDate for client ${firstName} ${lastName}`);
          }

          // Filter out clients who requested not to send, UNLESS they are late
          // If client is not late and has requestNotTosend === 'true', skip them
          // IMPORTANT: If client is late, ALWAYS send message regardless of requestNotTosend
          if (!isLate && requestNotTosend === "true") {
            console.log(`Skipping client ${firstName} ${lastName} - requested not to send and NOT late (deadline: ${debtCycleEndDate || "N/A"})`);
            continue;
          }

          // Log if sending to a late client who requested not to send
          if (isLate && requestNotTosend === "true") {
            console.log(`Sending to LATE client ${firstName} ${lastName} despite requestNotTosend=true (deadline passed: ${debtCycleEndDate})`);
          }

          // Construct your reminder message
          let message = `Bonjour ${firstName || "Valued"} ${
            lastName || "Client"
          },\n` +
          `Ozali programmer lelo pona kofuta ${minPay} FC. ` +
          `Otikali na niongo ya ${debtLeft} FC. ` +
          `Epargnes na yo ezali: ${savings}FC.\n`;

          // Add late payment message if client is late
          // (This will be sent even if requestNotTosend is true)
          if (isLate) {
            message += `Ozali na retard makasi Mpenza. Kende Kofuta niongo.\n`;
          }

          message += `En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.`+
          `Merci pona confiance na FONDATION GERVAIS.`;

          try {
          // Send SMS via Africa's Talking
            const response = await sms.send({
              to: [formattedNumber],
              message,
            });
            // console.log(`SMS sent to ${formattedNumber} =>`, message);
            console.log(`SMS sent to ${formattedNumber} =>`, response);
            successCount++;
          } catch (error) {
            console.error(`Error sending SMS to ${formattedNumber}:`, error);
            failCount++;
          }
        }

        console.log(
            `===> Reminders done. Success: ${successCount}, Failed: ${failCount}`,
        );
        return null;
      } catch (error) {
        console.error("Error in scheduledSendRemindersTesting:", error);
        throw error; // Let Firebase log it as a function error
      }
    });
*/
// END OF COMMENTED TESTING FUNCTION


/**
 * Parse the custom "MM-DD-YYYY-HH-mm-SS" key into a real Date object.
 * Returns an invalid Date if parsing fails, so handle with caution.
 */
function parsePaymentKey(key) {
  // e.g. "3-20-2025-14-57-2"
  const [M, D, Y, h, m, s] = key.split("-");
  return new Date(Number(Y), Number(M) - 1, Number(D), Number(h), Number(m), Number(s));
}

/**
 * Finds the most recent payment entry in the 'payments' object by parsing the keys as dates.
 * Returns { key, amount } of the latest or null if no valid entries.
 */
function findLatestPayment(payments) {
  const keys = Object.keys(payments);
  if (keys.length === 0) return null;

  let latestKey = null;
  let latestDate = null;

  for (const k of keys) {
    const dateObj = parsePaymentKey(k); // attempt to parse
    if (!latestDate || dateObj > latestDate) {
      latestDate = dateObj;
      latestKey = k;
    }
  }

  if (!latestKey) return null;
  return {key: latestKey, amount: payments[latestKey]};
}

/**
 * Cloud Function: send SMS on payment or savings changes
 *  - If type === "register", do nothing (already handled elsewhere).
 *  - Trigger only if payments or savings changed.
 */
exports.sendPaymentOrSavingsUpdateSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onUpdate(async (change, context) => {
      const beforeData = change.before.data() || {};
      const afterData = change.after.data() || {};

      // 1) Skip if type is "register"
      if (afterData.type === "register") {
        console.log("Type is 'register'. Skipping...");
        return null;
      }

      // 2) Determine if 'payments' changed
      const paymentsBefore = beforeData.payments || {};
      const paymentsAfter = afterData.payments || {};
      const paymentsChanged =
      JSON.stringify(paymentsBefore) !== JSON.stringify(paymentsAfter);

      // 3) Determine if 'savings' changed
      const savingsBefore = Number(beforeData.savings) || 0;
      const savingsAfter = Number(afterData.savings) || 0;
      const savingsChanged = savingsBefore !== savingsAfter;

      // If neither changed, skip
      if (!paymentsChanged && !savingsChanged) {
        console.log("Neither payments nor savings changed. Skipping...");
        return null;
      }

      // Gather client info
      const firstName = afterData.firstName || "";
      const lastName = afterData.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const phoneNumber = afterData.phoneNumber;
      const debtLeft = Number(afterData.debtLeft) || 0;

      if (!phoneNumber) {
        console.log("Client has no phone number. Skipping SMS...");
        return null;
      }
      const formattedNumber = makeValidE164(phoneNumber);
      if (!formattedNumber) {
        console.log(`Invalid phone number: ${phoneNumber}`);
        return null;
      }

      // We'll need the latest payment if 'payments' changed
      let paymentJustPaid = null;
      let latestPaymentKey = null;
      if (paymentsChanged) {
        const latest = findLatestPayment(paymentsAfter);
        if (latest) {
          paymentJustPaid = Number(latest.amount) || 0;
          latestPaymentKey = latest.key;
        }
      }

      // For the savings difference
      const savingsDiff = savingsAfter - savingsBefore;
      // Example:
      //   if > 0, "Obakisi epargnes na yo ya XXX FC"
      //   if < 0, "Olongoli epargnes na yo ya XXX FC"
      const absoluteSavingsDiff = Math.abs(savingsDiff);

      // Build the final message (4 main cases + optional nuance if both changed but savings decreased)
      let message = "";

      // CASE 1: Only payments changed
      if (paymentsChanged && !savingsChanged) {
      // {firstname}{lastname}, Ofuti mombongo ya {paymentJustpaid} FC
      // Otikali na Niongo ya {debtLeft} FC. Epargnes na yo ezali {savings}.
      // Merci pona confiance na Fondation Gervais.
        message = `${fullName}, Ofuti mombongo ya ${paymentJustPaid} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.
Merci pona confiance na FONDATION GERVAIS.`;
      }

      // CASE 2 or 3: Only savings changed
      else if (!paymentsChanged && savingsChanged) {
        if (savingsDiff > 0) {
        // CASE 2: savings added
        // {firstname}{lastname}, Obakisi epargnes na yo ya {savingsAdded} FC
          message = `${fullName}, Obakisi epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.
Merci pona confiance na FONDATION GERVAIS.`;
        } else {
        // CASE 3: savings removed
        // {firstname}{lastname}, Olongoli epargnes na yo ya {savingsRemoved} FC
          message = `${fullName}, Olongoli epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.
Merci pona confiance na FONDATION GERVAIS.`;
        }
      }

      // CASE 4: Both payments and savings changed
      else if (paymentsChanged && savingsChanged) {
      // The user only explicitly provided a message for "added" savings,
      // but let's handle removal similarly if that case can happen.

        if (savingsDiff > 0) {
        // "Ofuti mombongo ya {paymentJustpaid} FC. Obakisi epargnes na yo ya {savingsAdded} FC"
          message = `${fullName}, Ofuti mombongo ya ${paymentJustPaid} FC. Obakisi epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850.
Merci pona confiance na FONDATION GERVAIS.`;
        } else {
        // If you need a "removal" version, do:
        // "Ofuti mombongo ya {paymentJustPaid} FC. Olongoli epargnes na yo ya {savingsRemoved} FC"
          message = `${fullName}, Ofuti mombongo ya ${paymentJustPaid} FC. Olongoli epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567 to 0899401993 to 0975849850. 
Merci pona confiance na FONDATION GERVAIS.`;
        }
      }

      console.log("Constructed message:", message);

      // Send the SMS
      try {
        const response = await sms.send({
          to: [formattedNumber],
          message,
        });
        console.log(`SMS sent to ${formattedNumber} =>`, response);
      } catch (error) {
        console.error("Error sending SMS:", error);
      }


      // ─────────────────────────────────────────────────────────────
      // NEW: Detect "just finished" transition (after a payment)
      //      Only when debtLeft went from > 0 to <= 0 AND payments changed.
      // ─────────────────────────────────────────────────────────────
      const debtBefore = Number(beforeData.debtLeft) || 0;
      const debtAfter = Number(afterData.debtLeft) || 0;

      const finishedNow =
      paymentsChanged &&
      debtBefore > 0 &&
      debtAfter <= 0;


      if (finishedNow) {
        console.log("🎉 Client just finished their debt. latestPaymentKey:", latestPaymentKey);

        const creditScore = Number(afterData.creditScore) || 0;

        let congratsMessage = "";
        if (creditScore < 20) {
        // Short congrats only
          congratsMessage =
`${fullName},
 Félicitations! Osilisi niongo (solde: 0 FC).
Merci pona confiance na FONDATION GERVAIS.`;
        } else {
        // Short invite to come back + perks summary
          congratsMessage =
`${fullName}, 
Félicitations! Osilisi kofuta (solde: 0 FC). Okoki kozua lisusu. Soki obongisi efuteli makambo ya kitoko eza: leka na bureau po oyeba nionso.
Merci pona confiance na FONDATION GERVAIS.`;
        }

        try {
          const resp2 = await sms.send({
            to: [formattedNumber],
            message: congratsMessage,
          });
          console.log(`Congrats SMS sent to ${formattedNumber} =>`, resp2);
        } catch (err) {
          console.error("Error sending Congrats SMS:", err);
        }
      } else {
        console.log("No 'finished debt' transition detected for this update.");
      }


      return null;
    });


exports.sendEmployeePayRemindersSMS = functions.https.onCall(async (data, ctx)=>{
  // if (!ctx.auth || !ctx.auth.token.admin)
  // {throw new functions.https.HttpsError("permission-denied", "Admin only");}

  const {type, employees=[]} = data;
  if (!["bonus", "paiement"].includes(type) || !Array.isArray(employees))
  {throw new functions.https.HttpsError("invalid-argument", "Bad payload");}

  let sent=0; let failed=0;
  for (const e of employees) {
    const to = makeValidE164(e.phoneNumber||"");
    if (!to) {failed++; continue;}

    const msg =
  `FONDATION GERVAIS : ${e.firstName} ${e.lastName}, ` +
  `votre ${type} est disponible. ` +
  `Allez le SIGNER dans l’appli pour déclencher le virement. ` +
  `Montant incorrect? Contactez +1 2156877614.`;

    try {
      await sms.send({to: [to], message: msg});
      sent++;
    } catch (err) {console.error(err); failed++;}
  }
  return {sent, failed};
});


// ───────────────────────────────────────────────────────────
// DAILY (08:05 Kinshasa) — Send agent/manager follow-ups per *location*
// Non-working agents' clients → managers of *that* location only
// Only send to roles: manager, agent, agent marketing/marketting
// ───────────────────────────────────────────────────────────
exports.scheduledSendAgentFollowups = functions.pubsub
    .schedule("5 8 * * *")
    .timeZone("Africa/Kinshasa")
    .onRun(async () => {
      try {
        const weekday = new Date().toLocaleString("en-US", {weekday: "long", timeZone: "Africa/Kinshasa"});
        if (weekday === "Sunday") {
          console.log("Sunday detected. Skipping employee follow-ups.");
          return null;
        }
        const frenchDate = new Date().toLocaleDateString("fr-FR", {timeZone: "Africa/Kinshasa"});

        const usersSnap = await db.collection("users").where("mode", "!=", "testing").get();
        if (usersSnap.empty) {console.log("No active users"); return null;}

        let totalSent = 0; let totalSkippedNoPhone = 0; let totalSkippedNoWork = 0; let totalSkippedRole = 0; let totalFailed = 0;

        for (const userDoc of usersSnap.docs) {
          const userId = userDoc.id;
          const defaultLocation =
          String(userDoc.get("firstName") || userDoc.get("lastName") || "").trim() || "Unknown";

          const [empSnap, cliSnap] = await Promise.all([
            db.collection("users").doc(userId).collection("employees").get(),
            db.collection("users").doc(userId).collection("clients").get(),
          ]);

          const employees = empSnap.docs.map((d) => ({id: d.id, ...d.data()}));
          const employeeByUid = new Map();
          for (const e of employees) {
            const uid = String(e.uid || e.id || "").trim();
            if (uid) employeeByUid.set(uid, e);
          }

          // Clients scheduled for *today* with debt, valid phone flag, and not "just started"
          const allClients = cliSnap.docs.map((d) => ({id: d.id, ...d.data()}));
          const clientsWithDebts = allClients.filter((c) => Number(c.debtLeft) > 0);
          const clientsToday = clientsWithDebts
              .filter((c) =>
                c.paymentDay === weekday &&
            c.isPhoneCorrect !== "false" &&
            didClientStartThisWeek(c),
              )
              .filter((c) => !isLeftQuitte(c)); // 🚫 drop "+Quitte"/left altogether

          // byAgent: agentUid -> { employee, current[], away[], location }
          const byAgent = new Map();
          // unassigned (no agent uid) → defaultLocation
          const unassignedByLoc = new Map(); // loc -> { current:[], away:[] }
          const ensureLocBucket = (map, loc) => {
            if (!map.has(loc)) map.set(loc, {current: [], away: []});
            return map.get(loc);
          };

          const pushToAgent = (bucket, uid, client) => {
            if (!uid || !employeeByUid.has(uid)) {
              ensureLocBucket(unassignedByLoc, defaultLocation)[bucket].push(client);
              return;
            }
            if (!byAgent.has(uid)) {
              const emp = employeeByUid.get(uid);
              byAgent.set(uid, {
                employee: emp,
                current: [],
                away: [],
                location: empLocation(emp, defaultLocation),
              });
            }
            byAgent.get(uid)[bucket].push(client);
          };

          for (const c of clientsToday) {
            const alive = !c.vitalStatus || String(c.vitalStatus).toLowerCase() === "vivant";
            const bucket = alive ? "current" : "away";
            const agentUid = String(c.agent || c.employeeUid || "").trim();
            pushToAgent(bucket, agentUid, c);
          }

          // Aggregate *per-location* from NON-working agents (+ unassigned)
          // aggregatedByLoc: loc -> { current:[], away:[] }
          const aggregatedByLoc = new Map(unassignedByLoc);
          for (const entry of byAgent.values()) {
            const emp = entry.employee;
            const loc = entry.location || defaultLocation;
            if (!isWorkingEmployee(emp)) {
              const acc = ensureLocBucket(aggregatedByLoc, loc);
              acc.current.push(...entry.current);
              acc.away.push(...entry.away);
            }
          }

          // Index managers by location (only working managers)
          const managersByLoc = new Map(); // loc -> Employee[]
          const workingManagersByLoc = new Map(); // loc -> boolean (has working manager)
          for (const e of employees) {
            if (roleOf(e) === "manager") {
              const loc = empLocation(e, defaultLocation);
              if (!managersByLoc.has(loc)) managersByLoc.set(loc, []);
              managersByLoc.get(loc).push(e);
              // Track if there's at least one working manager at this location
              if (isWorkingEmployee(e)) {
                workingManagersByLoc.set(loc, true);
              }
            }
          }

          // Send per employee (only those who are working + have valid phone + allowed role)
          const sendJobs = [];
          for (const e of employees) {
            if (!isAllowedRecipient(e)) {totalSkippedRole++; continue;}
            if (!isWorkingEmployee(e)) {totalSkippedNoWork++; continue;}

            const rawPhone = hasPhone(e);
            const to = makeValidE164(rawPhone || "");
            if (!to) {totalSkippedNoPhone++; continue;}

            const uid = String(e.uid || e.id || "").trim();
            const base = byAgent.get(uid) || {
              employee: e,
              current: [],
              away: [],
              location: empLocation(e, defaultLocation),
            };
            const isMgr = roleOf(e) === "manager";
            const myLoc = empLocation(e, defaultLocation);

            // Get aggregated load for this location
            const agg = aggregatedByLoc.get(myLoc) || {current: [], away: []};

            // Managers always get aggregated load for their location
            // If no working manager exists at this location, working agents also get aggregated load
            const hasWorkingManager = workingManagersByLoc.get(myLoc) === true;
            const shouldGetAggregated = isMgr || (!hasWorkingManager && agg.current.length > 0);

            const mergedCurrent = shouldGetAggregated ? [...base.current, ...agg.current] : base.current;

            // Defensive filter
            const effCurrent = mergedCurrent.filter((c) => !isLeftQuitte(c));
            const linesCurrent = effCurrent.map((c) => `• ${formatClientLine(c)}`);

            // Build message with appropriate note about aggregated clients
            const hasAggregatedClients = shouldGetAggregated && agg.current.length > 0;
            const aggregatedNote = hasAggregatedClients ?
              (isMgr ?
                  "⚠️ Inclus : clients des agents non actifs de votre site." :
                  "⚠️ Inclus : clients des agents non actifs (manager absent).") :
              "";

            const message =
            (!linesCurrent.length) ?
              buildRecruitmentMessage(e) :
              [
                `Bonjour ${e.firstName || ""} ${e.lastName || ""}, voici les suivis du ${frenchDate} :`,
                ...(linesCurrent.length ? ["", `En cours (${linesCurrent.length}) :`, ...linesCurrent] : []),
                ...(hasAggregatedClients ? ["", aggregatedNote] : []),
                "",
                "Merci pour la confiance à la FONDATION GERVAIS.",
              ].join("\n");

            sendJobs.push(
                sms.send({to: [to], message})
                    .then(() => {totalSent++;})
                    .catch((err) => {console.error("SMS send failed", err); totalFailed++;}),
            );
          }

          // Log if there is aggregated load for a given location but no working manager or agent at that location
          for (const [loc, agg] of aggregatedByLoc.entries()) {
            const hasAgg = (agg.current.length || agg.away.length);
            const hasWorkingMgr = workingManagersByLoc.get(loc) === true;
            if (hasAgg && !hasWorkingMgr) {
              // Check if there are any working agents at this location
              let hasWorkingAgent = false;
              for (const e of employees) {
                const empRole = roleOf(e);
                if (isAllowedRecipient(e) && isWorkingEmployee(e) && empRole !== "manager" && empLocation(e, defaultLocation) === loc) {
                  hasWorkingAgent = true;
                  break;
                }
              }
              if (!hasWorkingAgent) {
                console.log(`No working manager or agent found at location "${loc}" for user ${userId}; aggregated clients not routed for this site.`);
              }
            }
          }

          if (sendJobs.length) await Promise.allSettled(sendJobs);
        }

        console.log(
            `scheduledSendAgentFollowups DONE — sent: ${totalSent}, failed: ${totalFailed}, skipped(role): ${totalSkippedRole}, skipped(noWork): ${totalSkippedNoWork}, skipped(noPhone): ${totalSkippedNoPhone}`,
        );
        return null;
      } catch (err) {
        console.error("scheduledSendAgentFollowups error:", err);
        throw err;
      }
    });

/** ── helpers (reuse variants from your component/other functions) */
function roleOf(e) {
  return String((e && (e.role || e.position)) || "").trim().toLowerCase();
}
function isAllowedRecipient(e) {
  const r = roleOf(e);
  // Allowed roles ONLY
  if (r === "manager") return true;
  if (r === "agent") return true;
  // accept common spellings for marketing agents
  if (r === "agent marketing" || r === "agent marketting") return true;
  if (r === "stagaire" || r === "stagaire marketting") return true;
  // everything else (e.g., "auditrice", "auditor", etc.) is excluded
  return false;
}
function isWorkingEmployee(e) {
  if (!e) return false;
  const raw = String(e.status || e.workStatus || e.employmentStatus || "").trim().toLowerCase();
  return ["travaille", "tavaille", "en travail", "working", "work"].includes(raw);
}
function hasPhone(e) {
  return (e && (e.phoneNumber || e.telephone)) || "";
}
function empLocation(e, fallback) {
  return String(e.location || e.site || e.office || e.branch || fallback || "").trim();
}
function displayPhone(p) {
  const raw = (p || "").toString().trim();
  return raw.length ? raw : "numéro indisponible";
}
function toFr(n) {
  return Number(n || 0).toLocaleString("fr-FR", {maximumFractionDigits: 0});
}
function formatClientLine(c) {
  const min = minimumPayment(c);
  const debt = Number(c.debtLeft || 0);
  const phone = displayPhone(c.phoneNumber);
  return `${c.firstName || ""} ${c.lastName || ""} — ${phone} (min: ${toFr(min)} FC, dette: ${toFr(debt)} FC)`;
}
function buildRecruitmentMessage(e) {
  return [
    `Bonjour ${e.firstName || ""} ${e.lastName || ""},`,
    `Ozali na client programmé te lelo.`,
    `Profitez pona Marketting pe kolouka ba clients ya sika pe kotala ba clients oyo bafutaki te lobi.`,
    ``,
    `Merci pour la confiance à la FONDATION GERVAIS.`,
  ].join("\n");
}
function isLeftQuitte(c) {
  const fields = [
    c.status, c.clientStatus, c.followUpStatus, c.suiviStatus,
    c.state, c.stage, c.note, c.notes, c.flags, c.tags, c.labels,
  ];
  const parts = [];
  for (const f of fields) {
    if (!f) continue;
    if (Array.isArray(f)) parts.push(f.join(" "));
    else parts.push(String(f));
  }
  const txt = parts.join(" ").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b\+?quittee?\b|\bleft\b|\bparti(e)?\b/.test(txt);
}


/* ─────────────── Helpers ─────────────── */

const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const FR_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function norm(s) {return String(s == null ? "" : s).trim().toLowerCase();}

function paymentDayToIndex(label) {
  const n = norm(label);
  let i = EN_DAYS.indexOf(n);
  if (i >= 0) return i;
  i = FR_DAYS.indexOf(n);
  if (i >= 0) return i;
  const tri = n.slice(0, 3);
  i = EN_DAYS.findIndex((x) => x.slice(0, 3) === tri);
  if (i >= 0) return i;
  i = FR_DAYS.findIndex((x) => x.slice(0, 3) === tri);
  if (i >= 0) return i;
  return -1;
}

/** Build today info for a given IANA timezone (e.g., "Africa/Kinshasa") */
function dayInfo(timeZone, d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  });
  const parts = fmt.formatToParts(d);
  const getNum = (t) => Number((parts.find((p) => p.type === t) || {}).value);
  const wd = (parts.find((p) => p.type === "weekday") || {}).value || "Sunday";
  const m = getNum("month");
  const dd = getNum("day");
  const y = getNum("year");
  // Your app commonly uses "M-D-YYYY" (no leading zeros)
  const dayKey = `${m}-${dd}-${y}`;
  const dayIndex = EN_DAYS.indexOf(norm(wd));
  return {dayKey, dayIndex, y, m, dd};
}

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function computeMinPayment(c) {
  const total = Number(c.amountToPay || 0);
  const periods = Number(c.paymentPeriodRange || 0);
  if (!periods) return 0;
  return Math.round(total / periods);
}

function isAlive(c) {
  const v = norm(c.vitalStatus);
  return v === "" || v === "vivant";
}

function startedAtLeastAWeekAgo(targetY, targetM, targetD, startStr) {
  if (!startStr) return true;
  const parts = String(startStr).split("-").map(Number); // "MM-DD-YYYY"
  const mm = parts[0]; const dd = parts[1]; const yyyy = parts[2];
  if (!yyyy || !mm || !dd) return true;
  const start = new Date(yyyy, mm - 1, dd);
  const target = new Date(targetY, targetM - 1, targetD);
  const oneWeekAgo = new Date(target);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 6); // mirrors your UI logic
  return start <= oneWeekAgo;
}

function sameDayKey(startStr, dayKey) {
  return !!startStr && String(startStr).startsWith(dayKey);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ─────────────── Core per-owner job ─────────────── */

async function computeExpectedForOwnerDay(ownerUid, timeZone) {
  const info = dayInfo(timeZone, new Date());
  const {dayKey, dayIndex, y, m, dd} = info;
  const nowMs = Date.now();
  const sod = new Date(y, m - 1, dd).getTime();
  const mKey = monthKey(y, m);

  // Load all employees for this owner
  const empsSnap = await db.collection(`users/${ownerUid}/employees`).get();
  const agentUids = empsSnap.docs.map((d) => d.id).filter(Boolean);
  if (!agentUids.length) return;

  const expectedByAgent = new Map();

  // Pull clients in batches with 'in' (max 10 items)
  for (const group of chunk(agentUids, 10)) {
    const qs = await db.collection(`users/${ownerUid}/clients`)
        .where("agent", "in", group)
        .get();

    qs.forEach((doc) => {
      const c = doc.data();
      const agentUid = c.agent;
      const pdi = paymentDayToIndex(c.paymentDay);
      if (pdi !== dayIndex) return;

      // Eligibility mirrors your UI:
      if (!isAlive(c)) return; // alive
      if (Number(c.debtLeft || 0) <= 0) return; // has debt
      if (sameDayKey(c.debtCycleStartDate, dayKey)) return; // not starting today
      if (!startedAtLeastAWeekAgo(y, m, dd, c.debtCycleStartDate)) return; // ≥ ~1 week old

      const min = computeMinPayment(c);
      const prev = expectedByAgent.get(agentUid) || 0;
      expectedByAgent.set(agentUid, prev + (Number.isFinite(min) ? min : 0));
    });
  }

  // Write 'expected' per employee/day (write-once if already set)
  const writes = [];
  for (const [agentUid, expected] of expectedByAgent.entries()) {
    const ref = db.doc(`users/${ownerUid}/employees/${agentUid}/dayTotals/${dayKey}`);
    writes.push(
        db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const already = snap.exists ? Number((snap.data() || {}).expected || 0) : 0;
          if (already > 0) return; // keep first value (write-once)
          tx.set(ref, {
            expected,
            expectedSetMs: nowMs,
            dayKey,
            dayStartMs: sod,
            monthKey: mKey,
            updatedAtMs: nowMs,
          }, {merge: true});
        }),
    );
  }
  await Promise.allSettled(writes);
}

/* ─────────────── Owners selection ─────────────── */

// PROD: scan all users, filter out mode === 'testing'
async function getProdOwners() {
  const snap = await db.collection("users").get();
  return snap.docs
      .filter((d) => norm((d.data() || {}).mode) !== "testing")
      .map((d) => d.id);
}

// TEST: only users with mode === 'testing'
// async function getTestingOwners() {
//   const snap = await db.collection("users").where("mode", "==", "testing").get();
//   return snap.docs.map((d) => d.id);
// }

/* ─────────────── Scheduled functions ─────────────── */

/**
 * PROD — 08:00 Africa/Kinshasa, Monday–Saturday (skip Sunday).
 * Runs for every user EXCEPT those with mode="testing".
 */
exports.scheduleExpectedKinshasaProd = functions.pubsub
    .schedule("0 8 * * 1-6") // Mon–Sat at 08:00
    .timeZone("Africa/Kinshasa")
    .onRun(async () => {
      const owners = await getProdOwners();
      // Extra guard (even though cron excludes Sun)
      const {dayIndex} = dayInfo("Africa/Kinshasa", new Date());
      if (dayIndex === 0) return null; // Sunday
      for (const ownerUid of owners) {
        await computeExpectedForOwnerDay(ownerUid, "Africa/Kinshasa");
      }
      return null;
    });

/**
 * TESTING — 08:00 America/Los_Angeles (Las Vegas).
 * Runs ONLY for users with mode="testing".
 * (During testing, feel free to tweak cron, e.g.,  for every 10 minutes.)
 */
// exports.scheduleExpectedTestingPT = functions.pubsub
//     .schedule("25 20 * * *") // Daily at 08:00 PT
//     .timeZone("America/Los_Angeles")
//     .onRun(async () => {
//       const owners = await getTestingOwners();
//       for (const ownerUid of owners) {
//         await computeExpectedForOwnerDay(ownerUid, "America/Los_Angeles");
//       }
//       return null;
//     });

/* ═══════════════════════════════════════════════════════════════════════
   WHATSAPP CHATBOT  –  Twilio + Firestore state-machine
   ═══════════════════════════════════════════════════════════════════════ */

const twilioConfig = (functions.config() && functions.config().twilio) || {};
const TWILIO_ACCOUNT_SID = twilioConfig.account_sid || process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = twilioConfig.auth_token || process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_FROM = twilioConfig.whatsapp_from || process.env.TWILIO_WHATSAPP_FROM || "+18444357154";
const TWILIO_VALIDATE_SIGNATURE = String(
    twilioConfig.validate_signature || process.env.TWILIO_VALIDATE_SIGNATURE || "true",
).toLowerCase() !== "false";

let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

const WHATSAPP_SESSION_COLLECTION = "whatsappSessions";
const WHATSAPP_PHONE_INDEX_COLLECTION = "whatsappPhoneIndex";
const WHATSAPP_COMPLAINTS_COLLECTION = "whatsappComplaints";
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const WA_STATES = {
  MAIN_MENU: "MAIN_MENU",
  BALANCE: "BALANCE",
  PAYMENT_AMOUNT: "PAYMENT_AMOUNT",
  PAYMENT_CUSTOM: "PAYMENT_CUSTOM",
  PAYMENT_METHOD: "PAYMENT_METHOD",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  HISTORY: "HISTORY",
  COMPLAINT_TYPE: "COMPLAINT_TYPE",
  COMPLAINT_DETAIL: "COMPLAINT_DETAIL",
  AGENT: "AGENT",
};

const COMPLAINT_CATEGORIES = {
  "1": "Paiement non enregistré",
  "2": "Montant incorrect",
  "3": "Problème technique",
  "4": "Autre",
};

function normalizeWhatsAppPhone(raw) {
  return String(raw || "").replace(/[^+\d]/g, "");
}

function formatFC(amount) {
  const num = toNumber(amount);
  return num.toLocaleString("fr-FR") + " FC";
}

/* ─── Phone Index ─── */

function phoneToIndexKey(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "243" + digits.slice(1);
  if (digits.length === 9) return "243" + digits;
  if (digits.startsWith("1") && digits.length === 11) return digits;
  if (digits.length === 10) return "1" + digits;
  return digits;
}

exports.syncWhatsAppPhoneIndex = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onWrite(async (change, context) => {
      const {userId, clientId} = context.params;
      const after = change.after.exists ? change.after.data() : null;
      const before = change.before.exists ? change.before.data() : null;

      if (!after) {
        if (before && before.phoneNumber) {
          const key = phoneToIndexKey(before.phoneNumber);
          if (key) {
            const existing = await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${key}`).get();
            if (existing.exists && existing.get("clientId") === clientId && existing.get("userId") === userId) {
              await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${key}`).delete();
            }
          }
        }
        return;
      }

      const newPhone = after.phoneNumber || "";
      const oldPhone = (before && before.phoneNumber) || "";

      if (oldPhone && oldPhone !== newPhone) {
        const oldKey = phoneToIndexKey(oldPhone);
        if (oldKey) {
          const existing = await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${oldKey}`).get();
          if (existing.exists && existing.get("clientId") === clientId && existing.get("userId") === userId) {
            await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${oldKey}`).delete();
          }
        }
      }

      if (newPhone) {
        const key = phoneToIndexKey(newPhone);
        if (key) {
          await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${key}`).set({
            userId,
            clientId,
            firstName: after.firstName || "",
            lastName: after.lastName || "",
            phoneNumber: newPhone,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    });

exports.backfillWhatsAppPhoneIndex = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }
  const usersSnap = await db.collection("users").get();
  let indexed = 0;
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const clientsSnap = await db.collection(`users/${userId}/clients`).get();
    for (const clientDoc of clientsSnap.docs) {
      const clientData = clientDoc.data() || {};
      const phone = clientData.phoneNumber || "";
      if (!phone) continue;
      const key = phoneToIndexKey(phone);
      if (!key) continue;
      await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${key}`).set({
        userId,
        clientId: clientDoc.id,
        firstName: clientData.firstName || "",
        lastName: clientData.lastName || "",
        phoneNumber: phone,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      indexed++;
    }
  }
  return {ok: true, indexed};
});

/* ─── Session helpers ─── */

async function getWhatsAppSession(phone) {
  const snap = await db.doc(`${WHATSAPP_SESSION_COLLECTION}/${phone}`).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.updatedAt && data.updatedAt.toMillis) {
    const age = Date.now() - data.updatedAt.toMillis();
    if (age > SESSION_TIMEOUT_MS) return null;
  }
  return data;
}

async function updateWhatsAppSession(phone, fields) {
  await db.doc(`${WHATSAPP_SESSION_COLLECTION}/${phone}`).set({
    ...fields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

async function resetWhatsAppSession(phone, fields) {
  await db.doc(`${WHATSAPP_SESSION_COLLECTION}/${phone}`).set({
    state: WA_STATES.MAIN_MENU,
    tempData: {},
    ...fields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/* ─── Twilio send helper ─── */

async function sendWhatsAppMessage(to, body) {
  const client = getTwilioClient();
  if (!client) {
    console.error("Twilio client not configured");
    return;
  }
  const toNum = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const fromNum = `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  await client.messages.create({body, from: fromNum, to: toNum});
}

/* ─── Client lookup ─── */

async function lookupClientByPhone(phone) {
  const normalized = normalizeWhatsAppPhone(phone);
  const digits = normalized.replace(/^\+/, "");

  const snap = await db.doc(`${WHATSAPP_PHONE_INDEX_COLLECTION}/${digits}`).get();
  if (snap.exists) {
    const idx = snap.data();
    const clientSnap = await db.doc(`users/${idx.userId}/clients/${idx.clientId}`).get();
    if (clientSnap.exists) {
      return {userId: idx.userId, clientId: idx.clientId, client: clientSnap.data()};
    }
  }
  return null;
}

/* ─── Payment helpers ─── */

function getNextPaymentDate(client) {
  const payments = client.payments || {};
  const keys = Object.keys(payments).sort((a, b) => {
    const da = parseMonthDayYear(a);
    const db2 = parseMonthDayYear(b);
    if (!da || !db2) return 0;
    return db2.getTime() - da.getTime();
  });
  if (keys.length > 0) {
    const lastDate = parseMonthDayYear(keys[0]);
    if (lastDate) {
      const period = toNumber(client.paymentPeriodRange || 0);
      const weeksPerPayment = period === 4 ? 1 : (period === 8 ? 1 : 1);
      const next = new Date(lastDate);
      next.setDate(next.getDate() + weeksPerPayment * 7);
      return next;
    }
  }
  return null;
}

function formatDateFrench(date) {
  if (!date) return "N/A";
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function generateReceiptNumber() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `FG-${num}`;
}

function generateComplaintRef() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PL-${num}`;
}

/* ─── State handlers ─── */

function buildMainMenu(clientName) {
  return `🌟 Bienvenue chez Fondation Gervais!\n\nBonjour ${clientName}! Comment pouvons-nous vous aider aujourd'hui?\n\n[1] Voir mon solde\n[2] Faire un paiement\n[3] Historique des paiements\n[4] Soumettre une plainte\n[5] Parler à un agent\n\nRépondez avec le numéro de votre choix.`;
}

function buildUnrecognizedInput() {
  return `❓ Je n'ai pas compris.\n\nRépondez avec un chiffre:\n[1] Voir mon solde\n[2] Faire un paiement\n[3] Historique des paiements\n[4] Soumettre une plainte\n[5] Parler à un agent`;
}

async function handleMainMenu(input, session) {
  const choice = input.trim();
  const clientInfo = session._clientInfo;

  if (choice === "1") {
    const remainingDebt = toNumber(clientInfo.debtLeft || 0);
    const savings = toNumber(clientInfo.savings || 0);
    const amountToPay = toNumber(clientInfo.amountToPay || 0);
    const nextDate = getNextPaymentDate(clientInfo);

    const reply = `💳 VOTRE COMPTE\n\n👤 ${clientInfo.firstName || ""} ${clientInfo.lastName || ""}\n💵 Montant dû: ${formatFC(amountToPay)}\n📅 Échéance: ${nextDate ? formatDateFrench(nextDate) : "N/A"}\n💰 *Dette:* ${formatFC(remainingDebt)}\n🏦 Épargne: ${formatFC(savings)}\n\nQue voulez-vous faire?\n[1] Payer maintenant\n[2] Retour au menu principal`;
    return {reply, newState: WA_STATES.BALANCE, tempData: {}};
  }

  if (choice === "2") {
    const amountToPay = toNumber(clientInfo.amountToPay || 0);
    const nextDate = getNextPaymentDate(clientInfo);
    const reply = `💵 PAIEMENT\n\nMontant dû: ${formatFC(amountToPay)}\nÉchéance: ${nextDate ? formatDateFrench(nextDate) : "N/A"}\n\nQuel montant voulez-vous payer?\n[1] Payer ${formatFC(amountToPay)} (montant dû)\n[2] Payer un autre montant\n[3] Retour au menu principal`;
    return {reply, newState: WA_STATES.PAYMENT_AMOUNT, tempData: {suggestedAmount: amountToPay}};
  }

  if (choice === "3") {
    const payments = clientInfo.payments || {};
    const sorted = Object.entries(payments)
        .map(([key, val]) => ({date: key, amount: toNumber(val)}))
        .sort((a, b) => {
          const da = parseMonthDayYear(a.date);
          const db2 = parseMonthDayYear(b.date);
          if (!da || !db2) return 0;
          return db2.getTime() - da.getTime();
        })
        .slice(0, 3);

    if (sorted.length === 0) {
      const reply = `📋 HISTORIQUE\n\nAucun paiement trouvé.\n\n[0] Retour au menu principal`;
      return {reply, newState: WA_STATES.HISTORY, tempData: {}};
    }

    const sources = clientInfo.paymentSources || {};
    let lines = "";
    for (const p of sorted) {
      const d = parseMonthDayYear(p.date);
      const dateStr = d ? formatDateFrench(d) : p.date;
      const source = (sources[p.date] === "mobile_money") ? "Mobile Money" : "Manuel";
      lines += `\n✅ ${formatFC(p.amount)} - ${dateStr}\n   ${source} • Reçu #${generateReceiptNumber()}`;
    }

    const reply = `📋 HISTORIQUE (${sorted.length} derniers)${lines}\n\n[1] Voir plus\n[0] Retour au menu principal`;
    return {reply, newState: WA_STATES.HISTORY, tempData: {}};
  }

  if (choice === "4") {
    const reply = `📝 PLAINTE\n\nQuel type de problème?\n\n[1] Paiement non enregistré\n[2] Montant incorrect\n[3] Problème technique\n[4] Autre`;
    return {reply, newState: WA_STATES.COMPLAINT_TYPE, tempData: {}};
  }

  if (choice === "5") {
    const reply = `👤 AGENT HUMAIN\n\nUn agent va prendre en charge votre conversation.\n\n📞 Ou appelez-nous:\n+243 XX XXX XXXX\n\n🕐 Disponible:\nLun - Ven: 8h00 - 17h00\nSam: 8h00 - 12h00\n\n[0] Retour au menu principal`;
    return {reply, newState: WA_STATES.AGENT, tempData: {}};
  }

  return {reply: buildUnrecognizedInput(), newState: WA_STATES.MAIN_MENU, tempData: {}};
}

async function handleBalance(input, session) {
  const choice = input.trim();
  if (choice === "1") {
    const clientInfo = session._clientInfo;
    const amountToPay = toNumber(clientInfo.amountToPay || 0);
    const nextDate = getNextPaymentDate(clientInfo);
    const reply = `💵 PAIEMENT\n\nMontant dû: ${formatFC(amountToPay)}\nÉchéance: ${nextDate ? formatDateFrench(nextDate) : "N/A"}\n\nQuel montant voulez-vous payer?\n[1] Payer ${formatFC(amountToPay)} (montant dû)\n[2] Payer un autre montant\n[3] Retour au menu principal`;
    return {reply, newState: WA_STATES.PAYMENT_AMOUNT, tempData: {suggestedAmount: amountToPay}};
  }
  if (choice === "2" || choice === "0") {
    return {reply: buildMainMenu(session.clientName), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }
  return {reply: `❓ Je n'ai pas compris.\n\n[1] Payer maintenant\n[2] Retour au menu principal`, newState: WA_STATES.BALANCE, tempData: session.tempData || {}};
}

async function handlePaymentAmount(input, session) {
  const choice = input.trim();
  if (choice === "1") {
    const amount = toNumber(session.tempData && session.tempData.suggestedAmount || 0);
    const reply = `Via quel service?\n\n[1] M-Pesa (Vodacom)\n[2] Airtel Money\n[3] Orange Money\n[4] Annuler`;
    return {reply, newState: WA_STATES.PAYMENT_METHOD, tempData: {...(session.tempData || {}), paymentAmount: amount}};
  }
  if (choice === "2") {
    const reply = `Entrez le montant que vous souhaitez payer (en FC):`;
    return {reply, newState: WA_STATES.PAYMENT_CUSTOM, tempData: session.tempData || {}};
  }
  if (choice === "3" || choice === "0") {
    return {reply: buildMainMenu(session.clientName), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }
  const clientInfo = session._clientInfo;
  const amountToPay = toNumber(clientInfo.amountToPay || 0);
  return {reply: `❓ Je n'ai pas compris.\n\n[1] Payer ${formatFC(amountToPay)} (montant dû)\n[2] Payer un autre montant\n[3] Retour au menu principal`, newState: WA_STATES.PAYMENT_AMOUNT, tempData: session.tempData || {}};
}

async function handlePaymentCustom(input, session) {
  const cleaned = input.trim().replace(/[^\d]/g, "");
  const amount = toNumber(cleaned);
  if (amount <= 0) {
    return {reply: `❌ Montant invalide. Entrez un montant valide en FC:`, newState: WA_STATES.PAYMENT_CUSTOM, tempData: session.tempData || {}};
  }
  const reply = `Via quel service?\n\n[1] M-Pesa (Vodacom)\n[2] Airtel Money\n[3] Orange Money\n[4] Annuler`;
  return {reply, newState: WA_STATES.PAYMENT_METHOD, tempData: {...(session.tempData || {}), paymentAmount: amount}};
}

async function handlePaymentMethod(input, session) {
  const choice = input.trim();
  if (choice === "4" || choice === "0") {
    return {reply: buildMainMenu(session.clientName), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }

  const providerNames = {"1": "M-Pesa", "2": "Airtel Money", "3": "Orange Money"};
  if (!providerNames[choice]) {
    return {reply: `❓ Je n'ai pas compris.\n\n[1] M-Pesa (Vodacom)\n[2] Airtel Money\n[3] Orange Money\n[4] Annuler`, newState: WA_STATES.PAYMENT_METHOD, tempData: session.tempData || {}};
  }

  const providerName = providerNames[choice];
  const paymentAmount = toNumber(session.tempData && session.tempData.paymentAmount || 0);
  const clientInfo = session._clientInfo;
  const userId = session.userId;
  const clientId = session.clientId;
  const phone = clientInfo.phoneNumber || "";

  let paymentRef = null;
  let initOk = false;

  try {
    if (!FLEXPAY_MERCHANT || !FLEXPAY_TOKEN) {
      throw new Error("FlexPay configuration missing");
    }

    const phoneNormalized = normalizePhoneForFlexpay(phone);
    if (!phoneNormalized) {
      throw new Error("Invalid phone number for FlexPay");
    }

    const createdAtMs = Date.now();
    const reference = `KANK-${userId.slice(0, 6)}-${clientId.slice(0, 6)}-${createdAtMs}`;
    const dayKey = formatMonthDayYear(new Date());
    const paymentEntryKey = `${dayKey}-${new Date().getHours()}-${new Date().getMinutes()}-${new Date().getSeconds()}`;

    const requestBody = {
      merchant: FLEXPAY_MERCHANT,
      type: "1",
      reference,
      phone: phoneNormalized,
      amount: String(paymentAmount),
      currency: "CDF",
      callbackUrl: FLEXPAY_CALLBACK_URL,
    };

    const resp = await fetch(FLEXPAY_PAYMENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": toFlexpayBearer(FLEXPAY_TOKEN),
      },
      body: JSON.stringify(requestBody),
    });
    const initJson = await resp.json();

    const code = String((initJson && initJson.code) || "1");
    const orderNumber = String((initJson && initJson.orderNumber) || "");

    if (code !== "0" || !orderNumber) {
      throw new Error(`FlexPay rejected: ${initJson && initJson.message || "unknown"}`);
    }

    await db.doc(`users/${userId}/mobileMoneyTransactions/${reference}`).set({
      reference,
      orderNumber,
      clientUid: clientId,
      paymentAmount: String(paymentAmount),
      savingsAmount: "0",
      currency: "CDF",
      phoneRaw: phone,
      phoneNormalized,
      requestBody,
      initResponse: initJson,
      status: "PENDING",
      createdAtMs,
      updatedAtMs: Date.now(),
      ownerUid: userId,
      dayKey,
      paymentEntryKey,
      dbWriteDone: false,
      whatsappOriginated: true,
      whatsappPhone: session.phone || "",
    });

    await upsertMobileMoneyLookup(reference, {
      ownerUid: userId,
      clientUid: clientId,
      orderNumber,
      status: "PENDING",
      dbWriteDone: false,
      createdAtMs,
      whatsappOriginated: true,
    });

    paymentRef = reference;
    initOk = true;
  } catch (err) {
    console.error("WhatsApp payment initiation failed:", err);
  }

  if (initOk) {
    const reply = `⏳ Demande envoyée à ${providerName}...\n\nVérifiez votre téléphone et confirmez avec votre PIN.\n\nVous recevrez une confirmation ici une fois le paiement traité.`;
    return {reply, newState: WA_STATES.PAYMENT_PENDING, tempData: {...(session.tempData || {}), provider: providerName, paymentRef}};
  }

  const reply = `❌ Désolé, une erreur est survenue lors de l'envoi de la demande de paiement. Veuillez réessayer plus tard.\n\n[0] Retour au menu principal`;
  return {reply, newState: WA_STATES.MAIN_MENU, tempData: {}};
}

async function handlePaymentPending(input, session) {
  const choice = input.trim();
  if (choice === "0") {
    return {reply: buildMainMenu(session.clientName), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }
  return {reply: `⏳ Votre paiement est en cours de traitement. Veuillez patienter.\n\n[0] Retour au menu principal`, newState: WA_STATES.PAYMENT_PENDING, tempData: session.tempData || {}};
}

async function handleHistory(input, session) {
  const choice = input.trim();
  if (choice === "0") {
    return {reply: buildMainMenu(session.clientName), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }
  if (choice === "1") {
    const clientInfo = session._clientInfo;
    const payments = clientInfo.payments || {};
    const sorted = Object.entries(payments)
        .map(([key, val]) => ({date: key, amount: toNumber(val)}))
        .sort((a, b) => {
          const da = parseMonthDayYear(a.date);
          const db2 = parseMonthDayYear(b.date);
          if (!da || !db2) return 0;
          return db2.getTime() - da.getTime();
        })
        .slice(0, 10);

    const sources = clientInfo.paymentSources || {};
    let lines = "";
    for (const p of sorted) {
      const d = parseMonthDayYear(p.date);
      const dateStr = d ? formatDateFrench(d) : p.date;
      const source = (sources[p.date] === "mobile_money") ? "Mobile Money" : "Manuel";
      lines += `\n✅ ${formatFC(p.amount)} - ${dateStr}\n   ${source}`;
    }

    const reply = `📋 HISTORIQUE COMPLET (${sorted.length})${lines}\n\n[0] Retour au menu principal`;
    return {reply, newState: WA_STATES.HISTORY, tempData: {}};
  }
  return {reply: `❓ Je n'ai pas compris.\n\n[1] Voir plus\n[0] Retour au menu principal`, newState: WA_STATES.HISTORY, tempData: {}};
}

async function handleComplaintType(input, _session) {
  const choice = input.trim();
  const category = COMPLAINT_CATEGORIES[choice];
  if (!category) {
    return {reply: `❓ Je n'ai pas compris.\n\n[1] Paiement non enregistré\n[2] Montant incorrect\n[3] Problème technique\n[4] Autre`, newState: WA_STATES.COMPLAINT_TYPE, tempData: {}};
  }
  const reply = `Décrivez votre problème en détail.\nNous vous répondrons dans 24h.`;
  return {reply, newState: WA_STATES.COMPLAINT_DETAIL, tempData: {complaintCategory: category, complaintCategoryId: choice}};
}

async function handleComplaintDetail(input, session) {
  const description = input.trim();
  if (!description || description.length < 3) {
    return {reply: `Veuillez décrire votre problème en détail:`, newState: WA_STATES.COMPLAINT_DETAIL, tempData: session.tempData || {}};
  }

  const ref = generateComplaintRef();
  const category = (session.tempData && session.tempData.complaintCategory) || "Autre";

  await db.collection(WHATSAPP_COMPLAINTS_COLLECTION).add({
    phone: session.phone || "",
    clientId: session.clientId || "",
    userId: session.userId || "",
    clientName: session.clientName || "",
    category,
    categoryId: (session.tempData && session.tempData.complaintCategoryId) || "4",
    description,
    reference: ref,
    status: "open",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const reply = `✅ PLAINTE REÇUE\n\n🎫 Référence: #${ref}\n📂 Catégorie: ${category}\n\nNotre équipe vous contactera sous 24h.\n\nMerci pour votre patience. 🙏\nFondation Gervais\n\n[0] Retour au menu principal`;
  return {reply, newState: WA_STATES.MAIN_MENU, tempData: {}};
}

async function handleAgent(input, session) {
  const choice = input.trim();
  if (choice === "0") {
    return {reply: buildMainMenu(session.clientName), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }
  return {reply: `👤 Un agent vous contactera bientôt.\n\n📞 Ou appelez: +243 XX XXX XXXX\n\n[0] Retour au menu principal`, newState: WA_STATES.AGENT, tempData: {}};
}

/* ─── Main dispatcher ─── */

async function handleWhatsAppMessage(from, body) {
  const phone = normalizeWhatsAppPhone(from);
  const input = (body || "").trim();

  const clientResult = await lookupClientByPhone(phone);
  if (!clientResult) {
    return `Désolé, votre numéro n'est pas enregistré dans notre système.\n\nContactez Fondation Gervais pour vous inscrire.\n📞 +243 XX XXX XXXX`;
  }

  const {userId, clientId, client} = clientResult;
  const clientName = client.firstName || "Client";

  let session = await getWhatsAppSession(phone);
  if (!session) {
    await resetWhatsAppSession(phone, {
      userId,
      clientId,
      clientName,
      phone,
      state: WA_STATES.MAIN_MENU,
    });
    return buildMainMenu(clientName);
  }

  session._clientInfo = client;
  session.userId = session.userId || userId;
  session.clientId = session.clientId || clientId;
  session.clientName = session.clientName || clientName;
  session.phone = session.phone || phone;

  const state = session.state || WA_STATES.MAIN_MENU;

  const handlers = {
    [WA_STATES.MAIN_MENU]: handleMainMenu,
    [WA_STATES.BALANCE]: handleBalance,
    [WA_STATES.PAYMENT_AMOUNT]: handlePaymentAmount,
    [WA_STATES.PAYMENT_CUSTOM]: handlePaymentCustom,
    [WA_STATES.PAYMENT_METHOD]: handlePaymentMethod,
    [WA_STATES.PAYMENT_PENDING]: handlePaymentPending,
    [WA_STATES.HISTORY]: handleHistory,
    [WA_STATES.COMPLAINT_TYPE]: handleComplaintType,
    [WA_STATES.COMPLAINT_DETAIL]: handleComplaintDetail,
    [WA_STATES.AGENT]: handleAgent,
  };

  const handler = handlers[state] || handleMainMenu;
  let result;
  try {
    result = await handler(input, session);
  } catch (err) {
    console.error("WhatsApp handler error:", err);
    result = {reply: buildUnrecognizedInput(), newState: WA_STATES.MAIN_MENU, tempData: {}};
  }

  await updateWhatsAppSession(phone, {
    state: result.newState,
    tempData: result.tempData || {},
    userId,
    clientId,
    clientName,
    phone,
  });

  return result.reply;
}

/* ─── Webhook endpoint ─── */

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (TWILIO_VALIDATE_SIGNATURE && TWILIO_AUTH_TOKEN && !isValidTwilioSignature(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  const from = String((req.body && req.body.From) || "").trim();
  const body = String((req.body && req.body.Body) || "").trim();

  if (!from) {
    res.status(400).send("Missing From");
    return;
  }

  let reply;
  try {
    reply = await handleWhatsAppMessage(from, body);
  } catch (err) {
    console.error("whatsappWebhook error:", err);
    reply = "Une erreur est survenue. Veuillez réessayer.";
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
  res.set("Content-Type", "text/xml");
  res.status(200).send(twiml);
});

function escapeXml(str) {
  return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
}

function buildTwilioSignatureUrlCandidates(req) {
  const protoHeader = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = protoHeader || "https";
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const hostNoDefaultPort = hostHeader.replace(/:443$|:80$/, "");
  const functionTarget = String(process.env.FUNCTION_TARGET || "").trim();
  const originalUrl = String(req.originalUrl || req.url || "");
  const pathOnly = originalUrl.split("?")[0];

  const candidates = new Set();
  for (const p of [proto, "https"]) {
    for (const h of [hostHeader, hostNoDefaultPort]) {
      if (!h) continue;
      candidates.add(`${p}://${h}${originalUrl}`);
      candidates.add(`${p}://${h}${pathOnly}`);
      if (functionTarget) {
        candidates.add(`${p}://${h}/${functionTarget}`);
        candidates.add(`${p}://${h}/${functionTarget}/`);
      }
    }
  }
  return Array.from(candidates);
}

function isValidTwilioSignature(req) {
  const signature = String(req.headers["x-twilio-signature"] || "");
  if (!signature || !TWILIO_AUTH_TOKEN) return false;

  const params = req.body || {};
  const urlCandidates = buildTwilioSignatureUrlCandidates(req);
  for (const url of urlCandidates) {
    try {
      if (twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params)) {
        return true;
      }
    } catch (err) {
      console.warn("Twilio signature validation threw for candidate URL:", {
        url,
        error: err && err.message ? err.message : String(err),
      });
    }
  }
  console.warn("Invalid Twilio signature", {
    host: req.headers.host || "",
    originalUrl: req.originalUrl || req.url || "",
    candidates: urlCandidates,
  });
  return false;
}

/* ─── FlexPay callback hook for WhatsApp payment notifications ─── */

async function notifyWhatsAppPaymentResult(reference, ownerUid, status) {
  const txSnap = await db.doc(`users/${ownerUid}/mobileMoneyTransactions/${reference}`).get();
  if (!txSnap.exists) return;

  const txData = txSnap.data() || {};
  if (!txData.whatsappOriginated) return;

  const whatsappPhone = txData.whatsappPhone || "";
  if (!whatsappPhone) return;

  const clientUid = txData.clientUid || "";
  const paymentAmount = toNumber(txData.paymentAmount || 0);

  if (status === "SUCCESS") {
    let clientName = "";
    let debtLeft = 0;
    let nextDateStr = "N/A";
    try {
      const clientSnap = await db.doc(`users/${ownerUid}/clients/${clientUid}`).get();
      if (clientSnap.exists) {
        const c = clientSnap.data();
        clientName = c.firstName || "";
        debtLeft = toNumber(c.debtLeft || 0);
        const nd = getNextPaymentDate(c);
        nextDateStr = nd ? formatDateFrench(nd) : "N/A";
      }
    } catch (e) {
      console.error("Error fetching client for WhatsApp notification:", e);
    }

    const receipt = generateReceiptNumber();
    const msg = `✅ PAIEMENT CONFIRMÉ!\n\n💵 ${formatFC(paymentAmount)} reçu via Mobile Money\n🧾 Reçu: #${receipt}\n📅 Prochain paiement: ${nextDateStr}\n💰 Solde restant: ${formatFC(debtLeft)}\n\nMerci ${clientName}! 🙏\nFondation Gervais vous souhaite une bonne journée.\n\n[0] Retour au menu principal`;
    await sendWhatsAppMessage(whatsappPhone, msg);

    await updateWhatsAppSession(whatsappPhone, {
      state: WA_STATES.MAIN_MENU,
      tempData: {},
    });
  } else if (status === "FAILED") {
    const reason = txData.failureReason || txData.callbackMessage || "";
    const msg = `❌ PAIEMENT ÉCHOUÉ\n\nLe paiement de ${formatFC(paymentAmount)} n'a pas abouti.${reason ? `\nRaison: ${reason}` : ""}\n\nVeuillez réessayer.\n\n[0] Retour au menu principal`;
    await sendWhatsAppMessage(whatsappPhone, msg);

    await updateWhatsAppSession(whatsappPhone, {
      state: WA_STATES.MAIN_MENU,
      tempData: {},
    });
  }
}

/* ─── Session timeout cleanup ─── */

exports.whatsappSessionCleanup = functions.pubsub
    .schedule("every 10 minutes")
    .timeZone(KINSHASA_TIME_ZONE)
    .onRun(async () => {
      const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - SESSION_TIMEOUT_MS);
      const expiredSnap = await db.collection(WHATSAPP_SESSION_COLLECTION)
          .where("updatedAt", "<", cutoff)
          .where("state", "!=", WA_STATES.MAIN_MENU)
          .get();

      for (const doc of expiredSnap.docs) {
        const data = doc.data() || {};
        const phone = data.phone || doc.id;

        try {
          await sendWhatsAppMessage(phone, `⏰ Session expirée.\n\nEnvoyez n'importe quel message pour recommencer.\n\nFondation Gervais 🌟`);
        } catch (e) {
          console.error("Failed to send timeout message:", e);
        }

        await db.doc(`${WHATSAPP_SESSION_COLLECTION}/${doc.id}`).delete();
      }
      return null;
    });
