/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
const crypto = require("crypto");

const SUPPORT_NUMBERS = ["0825333567", "0899401993", "0975849850"];
const SUPPORT_LINE = `Tel ${SUPPORT_NUMBERS.join("/")}.`;
const BRAND_LINE = "Fondation Gervais.";

const GSM_7_BASIC = new Set(Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./" +
    "0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿" +
    "abcdefghijklmnopqrstuvwxyzäöñüà",
));
const GSM_7_EXTENSION = new Set(Array.from("^{}\\[~]|€"));

function stableHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function buildSmsDeliveryId({messageType, dateKey, recipientKey, dedupeKey}) {
  return stableHash([
    messageType,
    dateKey || "event",
    recipientKey,
    dedupeKey || "default",
  ].join("|"));
}

function measureSms(input) {
  const message = String(input || "");
  let septets = 0;
  const nonGsmCharacters = [];

  for (const character of message) {
    if (GSM_7_BASIC.has(character)) {
      septets += 1;
    } else if (GSM_7_EXTENSION.has(character)) {
      septets += 2;
    } else {
      nonGsmCharacters.push(character);
    }
  }

  const encoding = nonGsmCharacters.length ? "UCS-2" : "GSM-7";
  const codeUnits = message.length;
  const segments = encoding === "GSM-7" ?
    (septets <= 160 ? 1 : Math.ceil(septets / 153)) :
    (codeUnits <= 70 ? 1 : Math.ceil(codeUnits / 67));

  return {
    characters: codeUnits,
    encoding,
    nonGsmCharacters: [...new Set(nonGsmCharacters)],
    segments,
    septets: encoding === "GSM-7" ? septets : null,
  };
}

function toGsmSafe(input) {
  const replacements = {
    "\u00a0": " ",
    "\u202f": " ",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": "\"",
    "\u201d": "\"",
    "\u2013": "-",
    "\u2014": "-",
    "\u2022": "-",
    "\u2026": "...",
    "\ufe0f": "",
  };
  const prepared = Array.from(String(input || ""))
      .map((character) => Object.prototype.hasOwnProperty.call(
          replacements,
          character,
      ) ? replacements[character] : character)
      .join("");
  let output = "";

  for (const character of prepared) {
    if (GSM_7_BASIC.has(character) || GSM_7_EXTENSION.has(character)) {
      output += character;
      continue;
    }

    const decomposed = character
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const safe = Array.from(decomposed)
        .filter((entry) => GSM_7_BASIC.has(entry) || GSM_7_EXTENSION.has(entry))
        .join("");
    output += safe || "?";
  }

  return output.replace(/\s+/g, " ").trim();
}

function compactName(fullName) {
  const safe = toGsmSafe(fullName).replace(/\s+/g, " ").trim();
  if (!safe) return "Client";
  return safe.split(" ")[0];
}

function formatAmount(value) {
  if (value == null || value === "") return "0";
  const raw = String(value).replace(/\s+/g, "").trim();
  const numeric = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return toGsmSafe(raw || "0");
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function selectCriticalMessage(candidates, targetSeptets = 150) {
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const message = toGsmSafe(candidate);
    if (!message || seen.has(message)) continue;
    seen.add(message);
    unique.push({message, measurement: measureSms(message)});
  }

  const target = unique.find((entry) =>
    entry.measurement.encoding === "GSM-7" &&
    entry.measurement.septets <= targetSeptets,
  );
  const oneSegment = unique.find((entry) => entry.measurement.segments === 1);
  const selected = target || oneSegment || unique
      .slice()
      .sort((left, right) =>
        left.measurement.segments - right.measurement.segments ||
        left.measurement.characters - right.measurement.characters,
      )[0];

  if (!selected) {
    throw new Error("At least one SMS candidate is required.");
  }

  return {
    ...selected,
    usedCompactFallback: selected.message !== unique[0].message,
  };
}

function clientNames(firstName, lastName) {
  const fullName = toGsmSafe(`${firstName || ""} ${lastName || ""}`)
      .replace(/\s+/g, " ")
      .trim() || "Client";
  return {fullName, firstName: compactName(fullName)};
}

function buildReminderMessage({
  firstName,
  lastName,
  minPayment,
  debtLeft,
  savings,
  isLate = false,
}) {
  const names = clientNames(firstName, lastName);
  const payment = formatAmount(minPayment);
  const debt = formatAmount(debtLeft);
  const saved = formatAmount(savings);
  const makeMessage = (name, savingsLabel) => isLate ?
    `${name}: Lelo futa FC${payment}. Niongo FC${debt}; ${savingsLabel} ` +
      `FC${saved}. Ozali na retard. ${SUPPORT_LINE} ${BRAND_LINE}` :
    `${name}: Lelo futa FC${payment}. Niongo etikali FC${debt}; ` +
      `${savingsLabel} FC${saved}. ${SUPPORT_LINE} ${BRAND_LINE}`;

  return selectCriticalMessage([
    makeMessage(names.fullName, "epargne"),
    makeMessage(names.firstName, "epargne"),
    makeMessage(names.firstName, "ep."),
    makeMessage("Client", "ep."),
  ]);
}

function buildPaymentUpdateMessage({
  firstName,
  lastName,
  paymentAmount,
  debtLeft,
  savingsAfter,
  savingsDifference,
  paymentsChanged,
  savingsChanged,
}) {
  const names = clientNames(firstName, lastName);
  const payment = formatAmount(paymentAmount);
  const debt = formatAmount(debtLeft);
  const saved = formatAmount(savingsAfter);
  const savingsDelta = formatAmount(Math.abs(Number(savingsDifference) || 0));
  const savingsAction = Number(savingsDifference) >= 0 ? "obakisi" : "olongoli";

  const makeAction = (savingsLabel) => {
    if (paymentsChanged && savingsChanged) {
      return `Ofuti FC${payment}; ${savingsAction} ${savingsLabel} FC${savingsDelta}.`;
    }
    if (paymentsChanged) return `Ofuti FC${payment}.`;
    return `${savingsAction[0].toUpperCase()}${savingsAction.slice(1)} ` +
      `${savingsLabel} FC${savingsDelta}.`;
  };
  const makeMessage = (name, savingsLabel) =>
    `${name}: ${makeAction(savingsLabel)} Niongo FC${debt}; ` +
    `epargne FC${saved}. ${SUPPORT_LINE} ${BRAND_LINE}`;
  const makeCompactMessage = () =>
    `Client: ${makeAction("ep.")} N. FC${debt}; ep. FC${saved}. ` +
    `${SUPPORT_LINE} ${BRAND_LINE}`;

  return selectCriticalMessage([
    makeMessage(names.fullName, "epargne"),
    makeMessage(names.firstName, "epargne"),
    makeMessage(names.firstName, "ep."),
    makeMessage("Client", "ep."),
    makeCompactMessage(),
  ]);
}

function buildRegistrationMessage({
  firstName,
  lastName,
  loanAmount,
  requestDate,
  fees,
  savings,
}) {
  const names = clientNames(firstName, lastName);
  const loan = formatAmount(loanAmount);
  const feeAmount = formatAmount(fees);
  const saved = formatAmount(savings);
  const date = toGsmSafe(requestDate || "N/A");
  const makeMessage = (name, savingsLabel) =>
    `${name}: Osengi niongo FC${loan} pona ${date}. Frais FC${feeAmount}; ` +
    `${savingsLabel} FC${saved}. ${SUPPORT_LINE} ${BRAND_LINE}`;

  return selectCriticalMessage([
    makeMessage(names.fullName, "epargne"),
    makeMessage(names.firstName, "epargne"),
    makeMessage(names.firstName, "ep."),
    makeMessage("Client", "ep."),
  ]);
}

function buildLoanActivationMessage({
  firstName,
  lastName,
  loanAmount,
  startDate,
  endDate,
  paymentCount,
  minimumPayment,
}) {
  const names = clientNames(firstName, lastName);
  const loan = formatAmount(loanAmount);
  const minimum = formatAmount(minimumPayment);
  const start = toGsmSafe(startDate || "N/A");
  const end = toGsmSafe(endDate || "N/A");
  const count = formatAmount(paymentCount);
  const makeMessage = (name) =>
    `${name}: Ozui niongo FC${loan}. Efuteli ${start}-${end}; ` +
    `${count} paiements, min FC${minimum}/semaine. ${SUPPORT_LINE} ${BRAND_LINE}`;

  return selectCriticalMessage([
    makeMessage(names.fullName),
    makeMessage(names.firstName),
    makeMessage("Client"),
  ]);
}

function buildEmployeeSummaryMessage({firstName, lastName, clientCount}) {
  const names = clientNames(firstName, lastName);
  const count = Math.max(0, Number(clientCount) || 0);
  const makeMessage = (name) => count ?
    `${name}: Ozali na ${count} clients ya kolandela lelo. ` +
      `Tala liste na application. ${SUPPORT_LINE} ${BRAND_LINE}` :
    `${name}: Client programme azali te lelo. Tala liste na application. ` +
      `${SUPPORT_LINE} ${BRAND_LINE}`;

  return selectCriticalMessage([
    makeMessage(names.fullName),
    makeMessage(names.firstName),
  ]);
}

function extractProviderCost(response) {
  const data = response && response.SMSMessageData;
  const recipients = data && Array.isArray(data.Recipients) ? data.Recipients : [];
  const recipient = recipients[0] || {};
  const messageCostMatch = ((data && data.Message) || "")
      .match(/Total Cost:\s*([A-Z]{3}\s*[0-9.,]+)/i);
  const rawCost = recipient.cost ||
    (messageCostMatch && messageCostMatch[1]) ||
    "";
  const match = String(rawCost).match(/([A-Z]{3})\s*([0-9.,]+)/i);
  const amount = match ? Number(match[2].replace(/,/g, "")) : null;

  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency: match ? match[1].toUpperCase() : null,
    messageId: recipient.messageId || null,
    status: recipient.status || null,
    statusCode: recipient.statusCode == null ? null : recipient.statusCode,
  };
}

module.exports = {
  BRAND_LINE,
  SUPPORT_LINE,
  SUPPORT_NUMBERS,
  buildSmsDeliveryId,
  buildEmployeeSummaryMessage,
  buildLoanActivationMessage,
  buildPaymentUpdateMessage,
  buildRegistrationMessage,
  buildReminderMessage,
  extractProviderCost,
  formatAmount,
  measureSms,
  selectCriticalMessage,
  stableHash,
  toGsmSafe,
};
