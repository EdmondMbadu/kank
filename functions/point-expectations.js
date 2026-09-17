"use strict";
/* eslint-disable require-jsdoc, max-len */

// This is the existing expected-FC scan, extended with an immutable client
// count. Nothing here runs when a browser submits a payment.
const TIME_ZONE = "Africa/Kinshasa";
const VERSION = "scheduled-client-points-v1";
const COLLECTION = "pointExpectationDays";
const DAY_MS = 86400000;
const MAX_CAPTURE_MINUTES = 30;
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const frenchDays = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function normalize(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseDay(value) {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:-|$)/.exec(String(value || ""));
  if (!match) return null;
  const [, m, d, y] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const date = new Date(ms);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? ms : null;
}

function businessDay(now = new Date()) {
  // Kinshasa is UTC+1 year-round. UTC calendar arithmetic is independent of
  // the function host's timezone and of a user's phone settings.
  const local = new Date(now.getTime() + 3600000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  return {
    dayKey: `${m}-${d}-${y}`,
    monthKey: `${y}-${String(m).padStart(2, "0")}`,
    calendarMs: Date.UTC(y, m - 1, d),
    dayStartMs: Date.UTC(y, m - 1, d) - 3600000,
    dayIndex: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function paymentDayIndex(value) {
  const label = normalize(value).replace(/\.$/, "");
  if (!label) return -1;
  return weekdays.findIndex((day, index) => day === label || frenchDays[index] === label ||
    (label.length === 3 && (day.slice(0, 3) === label || frenchDays[index].slice(0, 3) === label)));
}

function flagIssue(value, reason) {
  value.points = null;
  value.issues += 1;
  value.issueTypes ||= {};
  value.issueTypes[reason] = (value.issueTypes[reason] || 0) + 1;
}

function buildExpectations(employees, clients, day) {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const roster = new Map(employees.map((employee) => [employee.id, new Set(employee.clients || [])]));
  const expected = Object.fromEntries(employees.map((employee) => [employee.id, {points: 0, expectedFc: 0, issues: 0}]));
  const seen = new Map();
  for (const client of clients) {
    if (normalize(client.transferStatus) === "pending") continue;
    const agent = byId.get(client.agent);
    if (!agent) continue;
    const alive = normalize(client.vitalStatus);
    if (alive !== "" && alive !== "vivant") continue;
    // Only clients with a valid positive outstanding debt belong in the
    // workload. Blank/incomplete client records must not invalidate their
    // agent's expectation (and consequently the manager/global average).
    const debt = Number(client.debtLeft);
    if (!Number.isFinite(debt) || debt <= 0) continue;
    const start = parseDay(client.debtCycleStartDate);
    if (start !== null && start > day.calendarMs - 6 * DAY_MS) continue;
    const scheduledDay = paymentDayIndex(client.paymentDay);
    if (scheduledDay >= 0 && scheduledDay !== day.dayIndex) continue;
    const value = expected[client.agent];
    if (scheduledDay < 0) {
      flagIssue(value, "invalid-payment-day");
      continue;
    }
    const stableId = String(client.globalClientId || client.id);
    if (seen.has(stableId)) {
      flagIssue(value, "duplicate-client-identity");
      if (seen.get(stableId) !== client.agent) {
        flagIssue(expected[seen.get(stableId)], "duplicate-client-identity");
      }
      continue;
    }
    seen.set(stableId, client.agent);
    const amount = Number(client.amountToPay);
    const period = Number(client.paymentPeriodRange);
    const minimum = amount / period;
    const validMinimum = Number.isFinite(minimum) && amount > 0 && period > 0;
    if (validMinimum) value.expectedFc += Math.round(minimum);
    // These are assignment buckets, not a filter of active staff. Clients
    // assigned to an inactive employee still belong to the manager's site
    // workload, which aggregates ALL buckets. Status alone is never an issue.
    // Never manufacture a count from incomplete schedules/assignments: the
    // existing habitual rule requires BOTH client.agent and the roster.
    if (start === null || !roster.get(agent.id).has(client.id) || !validMinimum) {
      flagIssue(value, start === null ? "invalid-cycle-start" :
        !roster.get(agent.id).has(client.id) ? "agent-roster-mismatch" : "invalid-minimum");
    } else if (value.points !== null) {
      value.points += 1;
    }
  }
  return expected;
}

async function freezeOwnerExpectations({db, ownerUid, day, now, ownerSince = day.dayKey}) {
  const ref = db.doc(`users/${ownerUid}/${COLLECTION}/${day.dayKey}`);
  const previous = await ref.get();
  if (previous.exists) return previous.data();
  // A late retry must reuse a frozen snapshot, not the portfolio after people
  // paid. A missed capture remains explicitly unverified, never guessed.
  if (businessDay(now).dayKey !== day.dayKey || businessDay(now).minutes > MAX_CAPTURE_MINUTES) {
    throw new Error(`No early snapshot available for ${ownerUid}/${day.dayKey}`);
  }
  const employeeSnap = await db.collection(`users/${ownerUid}/employees`)
      .select("clients", "status", "expectedPointsSince").get();
  const employees = employeeSnap.docs.map((doc) => ({...doc.data(), id: doc.id,
    createdOn: doc.createTime ? businessDay(doc.createTime.toDate()).dayKey : day.dayKey}));
  const clients = [];
  for (let offset = 0; offset < employees.length; offset += 10) {
    const group = employees.slice(offset, offset + 10).map((employee) => employee.id);
    // Do not download large historical payments/gallery maps to count clients.
    const snapshot = await db.collection(`users/${ownerUid}/clients`).where("agent", "in", group)
        .select("agent", "paymentDay", "vitalStatus", "debtLeft", "debtCycleStartDate",
            "amountToPay", "paymentPeriodRange", "globalClientId", "transferStatus").get();
    snapshot.docs.forEach((doc) => clients.push({...doc.data(), id: doc.id}));
  }
  const capture = {
    dayKey: day.dayKey, monthKey: day.monthKey, dayStartMs: day.dayStartMs,
    capturedAtMs: now.getTime(), version: VERSION, status: "frozen",
    employees: buildExpectations(employees, clients, day),
    clientDocumentCount: clients.length,
  };
  for (const employee of employees) {
    // A first failed scan must not vanish when the next day succeeds. Start
    // at activation for pre-existing employees, but not before a new record
    // (including rotation copies) actually existed.
    const start = Math.min(day.calendarMs, Math.max(parseDay(ownerSince) ?? day.calendarMs,
        parseDay(employee.createdOn) ?? day.calendarMs));
    const date = new Date(start);
    capture.employees[employee.id].sinceDay = employee.expectedPointsSince ||
      `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
  }
  if (Buffer.byteLength(JSON.stringify(capture)) > 700000) throw new Error("Expectation snapshot exceeds safe document size");
  try {
    await ref.create(capture);
    return capture;
  } catch (error) {
    if (error.code !== 6 && error.code !== "already-exists") throw error;
    return (await ref.get()).data();
  }
}

async function publishOwnerExpectations({db, fieldPath, ownerUid, capture}) {
  const FieldPath = fieldPath;
  let writes = 0;
  const employees = Object.entries(capture.employees);
  // Small bounded fan-out; errors are inspected, not swallowed by allSettled.
  for (let offset = 0; offset < employees.length; offset += 8) {
    const results = await Promise.allSettled(employees.slice(offset, offset + 8).map(async ([employeeId, value]) => {
      const employeeRef = db.doc(`users/${ownerUid}/employees/${employeeId}`);
      const totalRef = employeeRef.collection("dayTotals").doc(capture.dayKey);
      return db.runTransaction(async (tx) => {
        const employee = await tx.get(employeeRef);
        const total = await tx.get(totalRef);
        if (!employee.exists) throw new Error(`Employee removed during capture: ${employeeId}`);
        const totals = total.exists ? total.data() : {};
        if (totals.pointExpectationVersion === VERSION) return 0;
        const employeeData = employee.data();
        const data = {expectedPoints: {[capture.dayKey]: value.points}};
        const mergeFields = [new FieldPath("expectedPoints", capture.dayKey)];
        if (!employeeData.expectedPointsSince) {
          data.expectedPointsSince = value.sinceDay || capture.dayKey;
          mergeFields.push("expectedPointsSince");
        }
        tx.set(employeeRef, data, {mergeFields});
        tx.set(totalRef, {
          // Keep an existing positive FC snapshot during mixed-version rollout.
          expected: Number(totals.expected) > 0 ? totals.expected : value.expectedFc,
          expectedSetMs: totals.expectedSetMs || capture.capturedAtMs,
          expectedPoints: value.points,
          pointExpectationVersion: VERSION,
          pointExpectationIssues: value.issues,
          pointExpectationCapturedAtMs: capture.capturedAtMs,
          dayKey: capture.dayKey, monthKey: capture.monthKey,
          // Mixed-version cash ledgers already have their own timestamps.
          // Do not shift a collected day's range or move its update backwards.
          dayStartMs: Number.isFinite(totals.dayStartMs) ? totals.dayStartMs : capture.dayStartMs,
          updatedAtMs: Math.max(Number(totals.updatedAtMs) || 0, capture.capturedAtMs),
        }, {merge: true});
        // Never set/reset dailyPoints or total: actual collections survive.
        return 2;
      });
    }));
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      writes += result.value;
    }
  }
  if (capture.status !== "complete") {
    await db.doc(`users/${ownerUid}/${COLLECTION}/${capture.dayKey}`).update({status: "complete"});
    writes += 1;
  }
  return {employees: employees.length, writes, issues: employees.reduce((sum, [, value]) => sum + value.issues, 0)};
}

async function capturePointExpectations({db, fieldPath, now = new Date(), scheduledAt = now}) {
  if (now.getTime() - scheduledAt.getTime() >= DAY_MS) {
    // Keep missing coverage visible, but stop an expired Pub/Sub event from
    // retrying for seven days and competing with fresh captures/costs.
    console.error("Expired point expectation retry; manual review required", {scheduledAt: scheduledAt.toISOString()});
    return {expiredRetry: true, dayKey: businessDay(scheduledAt).dayKey};
  }
  const day = businessDay(scheduledAt);
  if (day.dayIndex === 0) return {dayKey: day.dayKey, skipped: "sunday"};
  const users = await db.collection("users").select("mode", "pointExpectationSince").get();
  const owners = users.docs.filter((doc) => normalize(doc.data().mode) !== "testing");
  const failures = [];
  let writes = 0;
  let clientDocumentCount = 0;
  let issues = 0;
  for (const owner of owners) {
    try {
      // One scalar in the user already read by the app enables gap detection,
      // even when an entire owner's first scan fails. It is never client-owned.
      const ownerSince = owner.data().pointExpectationSince || await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(owner.ref);
        if (!snapshot.data().pointExpectationSince) {
          tx.update(owner.ref, {pointExpectationSince: day.dayKey});
        }
        return snapshot.data().pointExpectationSince || day.dayKey;
      });
      const capture = await freezeOwnerExpectations({db, ownerUid: owner.id, day, now, ownerSince});
      const result = await publishOwnerExpectations({db, fieldPath, ownerUid: owner.id, capture});
      writes += result.writes;
      issues += result.issues;
      clientDocumentCount += capture.clientDocumentCount;
    } catch (error) {
      failures.push(owner.id);
      console.error("Point expectation capture failed", {ownerUid: owner.id, dayKey: day.dayKey, error: error.message});
    }
  }
  if (failures.length) throw new Error(`Expectation capture failed for ${failures.length} owner(s): ${failures.join(",")}`);
  return {dayKey: day.dayKey, owners: owners.length, writes, clientDocumentCount, issues};
}

module.exports = {TIME_ZONE, VERSION, businessDay, buildExpectations, capturePointExpectations, freezeOwnerExpectations, publishOwnerExpectations};
