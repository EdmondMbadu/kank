"use strict";
/* eslint-disable require-jsdoc, max-len */
const admin = require("firebase-admin");
const {randomUUID} = require("node:crypto");
const {businessDay, buildExpectations, VERSION} = require("../point-expectations");
const ACK = "I_APPROVE_THIS_EXPECTED_POINTS_CORRECTION";

function parseArgs(argv) {
  const args = {project: "", action: "audit", owner: "", employee: "", day: businessDay().dayKey, expectedPoints: null, reason: "", apply: false, ack: ""};
  const keys = {"--project": "project", "--action": "action", "--owner": "owner", "--employee": "employee", "--day": "day", "--reason": "reason", "--ack": "ack", "--expected-points": "expectedPoints"};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") {
      args.apply = true; continue;
    }
    const key = keys[argv[i]];
    if (!key || !argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`Invalid argument: ${argv[i]}`);
    args[key] = argv[++i];
  }
  if (!args.project || !["audit", "correct"].includes(args.action)) throw new Error("Explicit --project and valid --action required");
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(args.day);
  if (!match) throw new Error("Invalid day key");
  const [, m, d, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 0));
  const day = businessDay(date);
  if (day.dayKey !== `${m}-${d}-${y}`) throw new Error("Invalid calendar day");
  args.day = day.dayKey;
  args.dayInfo = day;
  if (args.action === "audit" && args.apply) throw new Error("Audit is read-only");
  if (args.action === "correct") {
    if (![args.owner, args.employee].every((value) => /^[A-Za-z0-9_-]+$/.test(value))) throw new Error("Exact owner/employee IDs required");
    if (args.expectedPoints === null || !/^\d+$/.test(String(args.expectedPoints))) throw new Error("Nonnegative integer --expected-points required");
    args.expectedPoints = Number(args.expectedPoints);
    if (!Number.isSafeInteger(args.expectedPoints) || args.expectedPoints > 100000) throw new Error("Expected points exceed safe limit");
    args.reason = args.reason.trim();
    if (args.reason.length < 5 || args.reason.length > 500) throw new Error("Provide a 5–500 character audit reason");
    if (args.apply && args.ack !== ACK) throw new Error(`Applying requires --ack ${ACK}`);
  }
  return args;
}

async function audit(db, args) {
  const owners = await db.collection("users").select("mode").get();
  const result = [];
  for (const owner of owners.docs) {
    if (String(owner.data().mode || "").trim().toLowerCase() === "testing" || (args.owner && owner.id !== args.owner)) continue;
    const employeeSnap = await owner.ref.collection("employees").select("clients", "status").get();
    const employees = employeeSnap.docs.map((doc) => ({...doc.data(), id: doc.id}));
    if (!employees.length) continue;
    const clients = [];
    for (let offset = 0; offset < employees.length; offset += 10) {
      const snapshot = await owner.ref.collection("clients").where("agent", "in", employees.slice(offset, offset + 10).map((employee) => employee.id))
          .select("agent", "paymentDay", "vitalStatus", "debtLeft", "debtCycleStartDate", "amountToPay", "paymentPeriodRange", "globalClientId", "transferStatus").get();
      snapshot.docs.forEach((doc) => clients.push({...doc.data(), id: doc.id}));
    }
    const expected = buildExpectations(employees, clients, args.dayInfo);
    const values = Object.values(expected);
    result.push({ownerUid: owner.id, employees: employees.length, clientsRead: clients.length,
      expectedPoints: values.reduce((sum, value) => sum + (value.points || 0), 0),
      unverifiedEmployees: values.filter((value) => value.points === null).length,
      issues: values.reduce((sum, value) => sum + value.issues, 0),
      unverified: Object.entries(expected).filter(([, value]) => value.points === null)
          .map(([employeeUid, value]) => ({employeeUid, reasons: value.issueTypes}))});
  }
  return {readOnly: true, previewOnly: true, dayKey: args.day, sites: result};
}

async function correct(db, args) {
  const employeeRef = db.doc(`users/${args.owner}/employees/${args.employee}`);
  const totalRef = employeeRef.collection("dayTotals").doc(args.day);
  const snapshotRef = db.doc(`users/${args.owner}/pointExpectationDays/${args.day}`);
  const auditRef = snapshotRef.collection("corrections").doc(randomUUID());
  return db.runTransaction(async (tx) => {
    const employee = await tx.get(employeeRef);
    const total = await tx.get(totalRef);
    const snapshot = await tx.get(snapshotRef);
    if (!employee.exists || !snapshot.exists || !snapshot.data().employees[args.employee]) throw new Error("No original frozen employee expectation exists; historical guesses/backfills are prohibited");
    if (!args.apply) return {readOnly: true, wouldCorrect: args.expectedPoints, previous: total.exists ? total.data().expectedPoints : null};
    tx.set(employeeRef, {expectedPoints: {[args.day]: args.expectedPoints}}, {mergeFields: [new admin.firestore.FieldPath("expectedPoints", args.day)]});
    tx.set(totalRef, {expectedPoints: args.expectedPoints, pointExpectationVersion: VERSION,
      pointExpectationIssues: 0, pointExpectationCorrectedAtMs: Date.now()}, {merge: true});
    tx.create(auditRef, {employeeId: args.employee, dayKey: args.day,
      previousPoints: total.exists ? total.data().expectedPoints ?? null : null,
      newPoints: args.expectedPoints, reason: args.reason,
      correctedAt: admin.firestore.FieldValue.serverTimestamp(), actor: "authenticated-admin-cli"});
    return {applied: true, auditPath: auditRef.path};
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  admin.initializeApp({projectId: args.project});
  const db = admin.firestore();
  console.log(JSON.stringify(args.action === "audit" ? await audit(db, args) : await correct(db, args), null, 2));
}
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message); process.exitCode = 1;
  });
}
module.exports = {parseArgs, ACK, audit, correct};
