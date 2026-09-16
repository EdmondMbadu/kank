const fs = require('node:fs');
const path = require('node:path');
const {before, after, beforeEach, test} = require('node:test');
const assert = require('node:assert/strict');
const {initializeTestEnvironment, assertFails, assertSucceeds} = require('@firebase/rules-unit-testing');
const admin = require('../functions/node_modules/firebase-admin');
const {businessDay, capturePointExpectations, freezeOwnerExpectations, publishOwnerExpectations} = require('../functions/point-expectations');
const {parseArgs, correct, ACK} = require('../functions/scripts/point-expectations-admin');
const PROJECT_ID = 'demo-kank-point-expectations';
let env;
let db;
const ownerPath = 'users/site';
const employeePath = `${ownerPath}/employees/agent`;
const day = '9-17-2026';

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Tests require isolated Firestore emulator');
  env = await initializeTestEnvironment({projectId: PROJECT_ID, firestore: {
    rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
  }});
  const app = admin.initializeApp({projectId: PROJECT_ID}, 'point-expectations-tests');
  db = app.firestore();
});
beforeEach(async () => {
  await env.clearFirestore();
  await db.doc(ownerPath).set({uid: 'site', pointExpectationSince: day});
  await db.doc(employeePath).set({uid: 'agent', status: 'Travaille', clients: ['client'], expectedPointsSince: day,
    expectedPoints: {[day]: 10}, dailyPoints: {'9-16-2026': '10'}, totalDailyPoints: {'9-16-2026': '10'}});
  await db.doc(`${employeePath}/dayTotals/${day}`).set({dayKey: day, total: 0, expected: 10000,
    expectedPoints: 10, pointExpectationVersion: 'scheduled-client-points-v1', pointExpectationCapturedAtMs: 1, pointExpectationIssues: 0});
});
after(async () => {if (env) await env.cleanup(); if (db) await db.terminate();});

test('old/offline employee writes and earned-only updates still work; captured values do not change', async () => {
  const staff = env.authenticatedContext('site').firestore();
  await assertSucceeds(staff.doc(employeePath).set({totalDailyPoints: {[day]: '0'}, dailyPoints: {[day]: '2'}}, {merge: true}));
  await assertSucceeds(staff.doc(employeePath).set({dailyPoints: {[day]: '3'}}, {merge: true}));
  await assertSucceeds(staff.doc(`${employeePath}/dayTotals/${day}`).set({total: 3000}, {merge: true}));
  assert.equal((await db.doc(employeePath).get()).data().expectedPoints[day], 10);
});

test('owner and cross-site admin cannot set/delete/type-juggle independent expected maps or activation date', async () => {
  for (const uid of ['site', 'admin']) {
    const staff = env.authenticatedContext(uid).firestore();
    for (const data of [{expectedPoints: {[day]: 0}}, {expectedPoints: 'fake'}, {expectedPointsSince: '9-18-2026'}]) {
      await assertFails(staff.doc(employeePath).set(data, {merge: true}));
    }
    await assertFails(staff.doc(employeePath).set({uid: 'agent'}));
    await assertFails(staff.doc(`${ownerPath}/employees/forged`).set({expectedPoints: {[day]: 0}}));
  }
  await assertFails(env.authenticatedContext('site').firestore().doc(ownerPath).update({pointExpectationSince: '9-18-2026'}));
});

test('owner wildcard cannot forge snapshots or overwrite server archives and nested captured fields', async () => {
  const staff = env.authenticatedContext('site').firestore();
  await assertFails(staff.doc(`${ownerPath}/pointExpectationDays/${day}`).set({employees: {agent: {points: 0}}}));
  for (const collection of ['firestoreV2Entries', 'firestoreV2Months', 'firestoreV2ReadMonths']) {
    await assertFails(staff.doc(`${employeePath}/${collection}/forged`).set({maps: {expectedPoints: {[day]: 0}}}));
  }
  await assertFails(staff.doc(`${employeePath}/dayTotals/${day}`).set({dayKey: day, total: 3000}));
  await assertFails(staff.doc(`${employeePath}/dayTotals/${day}`).update({expectedPoints: 0}));
  await assertFails(staff.doc(`${employeePath}/custom/x/deeper/y`).set({expectedPoints: {[day]: 0}}));
});

test('existing attendance, payment and cross-site employee operations remain allowed; portal/public denied', async () => {
  const owner = env.authenticatedContext('site').firestore();
  await assertSucceeds(owner.doc(`${employeePath}/payments/p`).set({dayKey: day, amount: 1000}));
  await assertSucceeds(owner.doc(`${employeePath}/attendance/2026-09-17`).set({status: 'P'}));
  await assertSucceeds(owner.doc(`${ownerPath}/employees/new`).set({uid: 'new', dailyPoints: {}, totalDailyPoints: {}}));
  await assertSucceeds(env.authenticatedContext('other-staff').firestore().doc(employeePath).update({role: 'Auditrice'}));
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('portal', {portalClient: true})]) {
    const firestore = context.firestore();
    await assertFails(firestore.doc(employeePath).update({dailyPoints: {[day]: '10'}}));
    await assertFails(firestore.doc(`${ownerPath}/pointExpectationDays/${day}`).get());
  }
});

async function preparePortfolio() {
  await env.clearFirestore();
  await db.doc(ownerPath).set({uid: 'site'});
  await db.doc(employeePath).set({uid: 'agent', status: 'Travaille', clients: ['client'], dailyPoints: {[day]: '3'}});
  await db.doc(`${ownerPath}/employees/empty`).set({uid: 'empty', status: 'Travaille', clients: []});
  await db.doc(`${ownerPath}/clients/client`).set({agent: 'agent', debtLeft: '5000', amountToPay: '10000', paymentPeriodRange: '10',
    paymentDay: 'Jeudi', debtCycleStartDate: '9-1-2026'});
  await db.doc(`${employeePath}/dayTotals/${day}`).set({total: 3000, count: 3,
    dayStartMs: Date.parse('2026-09-17T00:00:00Z'), updatedAtMs: Date.parse('2026-09-17T10:00:00Z')});
}

test('real capture is idempotent, freezes counts, preserves actuals, captures zero workload without a payment', async () => {
  await preparePortfolio();
  const now = new Date('2026-09-16T23:05:00Z');
  await capturePointExpectations({db, fieldPath: admin.firestore.FieldPath, now});
  assert.equal((await db.doc(employeePath).get()).data().expectedPoints[day], 1);
  assert.equal((await db.doc(`${ownerPath}/employees/empty`).get()).data().expectedPoints[day], 0);
  assert.equal((await db.doc(employeePath).get()).data().dailyPoints[day], '3');
  await db.doc(`${ownerPath}/clients/client`).update({debtLeft: '0'});
  const result = await capturePointExpectations({db, fieldPath: admin.firestore.FieldPath, now: new Date('2026-09-17T15:00:00Z'), scheduledAt: now});
  assert.equal(result.writes, 0);
  const totals = (await db.doc(`${employeePath}/dayTotals/${day}`).get()).data();
  assert.equal(totals.expectedPoints, 1);
  assert.equal(totals.expected, 1000);
  assert.equal(totals.total, 3000);
  assert.equal(totals.count, 3);
  assert.equal(totals.dayStartMs, Date.parse('2026-09-17T00:00:00Z'));
  assert.equal(totals.updatedAtMs, Date.parse('2026-09-17T10:00:00Z'));
  assert.equal((await db.doc(`${ownerPath}/employees/empty/dayTotals/${day}`).get()).data().dayStartMs,
      Date.parse('2026-09-16T23:00:00Z'));
});

test('real capture includes inactive assignments without issues and freezes the manager workload after payoff', async () => {
  await preparePortfolio();
  await db.doc(employeePath).update({status: 'Quitté', dateLeft: '9-1-2026', dailyPoints: {}});
  await db.doc(`${ownerPath}/employees/empty`).update({status: 'Quitté'});
  await db.doc(`${ownerPath}/employees/manager`).set({uid: 'manager', role: 'Manager', status: 'Travaille', clients: []});
  const now = new Date('2026-09-16T23:05:00Z');
  const result = await capturePointExpectations({db, fieldPath: admin.firestore.FieldPath, now});
  assert.equal(result.issues, 0);
  const snapshot = (await db.doc(`${ownerPath}/pointExpectationDays/${day}`).get()).data();
  assert.equal(snapshot.employees.agent.points, 1);
  assert.equal(snapshot.employees.agent.issues, 0);
  assert.equal(snapshot.employees.empty.points, 0);
  assert.equal(snapshot.employees.manager.points, 0);
  assert.equal(Object.values(snapshot.employees).reduce((sum, value) => sum + value.points, 0), 1);
  const totals = (await db.doc(`${employeePath}/dayTotals/${day}`).get()).data();
  assert.equal(totals.expected, 1000);
  assert.equal(totals.expectedPoints, 1);
  assert.equal(totals.pointExpectationIssues, 0);
  assert.equal(totals.total, 3000);
  assert.deepEqual((await db.doc(employeePath).get()).data().dailyPoints, {});
  await db.doc(`${ownerPath}/clients/client`).update({debtLeft: '0'});
  const retry = await capturePointExpectations({db, fieldPath: admin.firestore.FieldPath,
    now: new Date('2026-09-17T15:00:00Z'), scheduledAt: now});
  assert.equal(retry.writes, 0);
  assert.equal((await db.doc(employeePath).get()).data().expectedPoints[day], 1);
});

test('publication failure remains frozen and retry uses snapshot after payoff, not current debt', async () => {
  await preparePortfolio();
  const now = new Date('2026-09-16T23:05:00Z');
  const capture = await freezeOwnerExpectations({db, ownerUid: 'site', now, day: businessDay(now)});
  const failingDb = Object.create(db);
  failingDb.runTransaction = (callback) => db.runTransaction((tx) => {
    const wrapper = Object.create(tx);
    wrapper.set = (ref, ...args) => {
      if (ref.path === employeePath) throw new Error('simulated publication failure');
      return tx.set(ref, ...args);
    };
    return callback(wrapper);
  });
  await assert.rejects(publishOwnerExpectations({db: failingDb, fieldPath: admin.firestore.FieldPath, ownerUid: 'site', capture}), /simulated/);
  assert.equal((await db.doc(`${ownerPath}/pointExpectationDays/${day}`).get()).data().status, 'frozen');
  await db.doc(`${ownerPath}/clients/client`).update({debtLeft: '0'});
  const frozen = await freezeOwnerExpectations({db, ownerUid: 'site', day: businessDay(now), now: new Date('2026-09-17T16:00:00Z')});
  await publishOwnerExpectations({db, fieldPath: admin.firestore.FieldPath, ownerUid: 'site', capture: frozen});
  assert.equal((await db.doc(employeePath).get()).data().expectedPoints[day], 1);
});

test('late first capture refuses to guess and leaves activation marker for UI gap detection', async () => {
  await preparePortfolio();
  await assert.rejects(capturePointExpectations({db, fieldPath: admin.firestore.FieldPath, now: new Date('2026-09-17T16:00:00Z')}), /failed/);
  assert.equal((await db.doc(ownerPath).get()).data().pointExpectationSince, day);
  assert.equal((await db.doc(`${ownerPath}/pointExpectationDays/${day}`).get()).exists, false);
});

test('audited correction is dry-run by default; application preserves actuals and original snapshot', async () => {
  await preparePortfolio();
  const now = new Date('2026-09-16T23:05:00Z');
  await capturePointExpectations({db, fieldPath: admin.firestore.FieldPath, now});
  const correctionArgs = ['--project', PROJECT_ID, '--action', 'correct', '--owner', 'site', '--employee', 'agent', '--day', day,
    '--expected-points', '2', '--reason', 'Approved scheduling correction'];
  const preview = await correct(db, parseArgs(correctionArgs));
  assert.equal(preview.readOnly, true);
  assert.equal((await db.doc(employeePath).get()).data().expectedPoints[day], 1);
  const result = await correct(db, parseArgs([...correctionArgs, '--apply', '--ack', ACK]));
  assert.ok(result.applied);
  assert.equal((await db.doc(employeePath).get()).data().expectedPoints[day], 2);
  assert.equal((await db.doc(`${employeePath}/dayTotals/${day}`).get()).data().total, 3000);
  assert.equal((await db.doc(`${ownerPath}/pointExpectationDays/${day}`).get()).data().employees.agent.points, 1);
  const corrections = await db.doc(`${ownerPath}/pointExpectationDays/${day}`).collection('corrections').get();
  assert.equal(corrections.size, 1);
  assert.equal(corrections.docs[0].data().newPoints, 2);
});
