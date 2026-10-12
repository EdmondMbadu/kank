const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {before, after, beforeEach, test} = require('node:test');
const ts = require('typescript');
const {initializeTestEnvironment, assertFails} = require('@firebase/rules-unit-testing');

// Run the production TypeScript service against real Firestore transactions.
// Only Angular's Injectable decorator is replaced; matching, reads and saves
// execute unchanged. No generated test copy of the business rule is maintained.
const modules = new Map();
function loadSource(filename) {
  const absolute = path.resolve(__dirname, '..', filename);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const module = {exports: {}};
  modules.set(absolute, module);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true},
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier === '@angular/core') return {Injectable: () => (value) => value};
    if (specifier.startsWith('.')) {
      return loadSource(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(absolute), `${specifier}.ts`)));
    }
    return require(specifier);
  };
  vm.runInThisContext(`(function(require, module, exports) {\n${code}\n})`, {filename: absolute})(localRequire, module, module.exports);
  return module.exports;
}
const {CardPhoneValidationService} = loadSource('src/app/services/card-phone-validation.service.ts');
const {CardPhoneValidationError} = loadSource('src/app/utils/card-phone-identity.util.ts');
const candidate = {firstName: 'Edmond', middleName: 'Mbadu', lastName: 'Ngoma', phoneNumber: '0812345678'};
const guardPath = `cardPhoneWriteGuards/${candidate.phoneNumber}`;
let env;

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'An isolated Firestore emulator is required');
  env = await initializeTestEnvironment({projectId: 'demo-kank-card-phone', firestore: {
    rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
  }});
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed({'users/site': {uid: 'site'}, 'users/other': {uid: 'other'}});
});
after(async () => {if (env) await env.cleanup();});

async function seed(records) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [key, value] of Object.entries(records)) await db.doc(key).set(value);
  });
}
async function allCards() {
  let cards;
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const snapshots = await Promise.all(['site', 'other'].map((owner) => db.collection(`users/${owner}/cards`).get()));
    cards = snapshots.flatMap((snapshot) => snapshot.docs);
  });
  return cards;
}
function submit(db, identity, owner, uid, excludeUid, transactionBarrier) {
  const firestore = transactionBarrier ? {
    collection: db.collection.bind(db), doc: db.doc.bind(db),
    runTransaction: async (callback) => {await transactionBarrier(); return db.runTransaction(callback);},
  } : db;
  return new CardPhoneValidationService({firestore}).commit(identity, owner, uid, (tx) => {
    tx.set(db.doc(`users/${owner}/cards/${uid}`), identity);
    tx.set(db.doc(`users/${owner}/cards/${uid}/events/event`), {type: excludeUid ? 'cycle_started' : 'card_created'});
  }, excludeUid);
}
function simultaneousBarrier() {
  let count = 0;
  let release;
  const ready = new Promise((resolve) => {release = resolve;});
  return async () => {if (++count === 2) release(); await ready;};
}

test('the pre-confirmation check is read-only when validation succeeds', async () => {
  const db = env.authenticatedContext('site').firestore();
  await new CardPhoneValidationService({firestore: db}).validate(candidate, 'site');
  assert.equal((await allCards()).length, 0);
  assert.equal((await db.doc(guardPath).get()).exists, false);
});

test('the reported phone conflict is detected in the pre-confirmation check without writes', async () => {
  const phoneNumber = '2342342342';
  await seed({'users/other/cards/existing': {...candidate, phoneNumber}});
  const db = env.authenticatedContext('site').firestore();
  const incoming = {firstName: 'Jeremi', middleName: 'Bulngu', lastName: 'Bakeni', phoneNumber};
  await assert.rejects(new CardPhoneValidationService({firestore: db}).validate(incoming, 'site'),
      (error) => error.reason === 'name-conflict' && error.message.includes('Edmond Mbadu Ngoma'));
  assert.equal((await allCards()).length, 1);
  assert.equal((await db.doc(`cardPhoneWriteGuards/${phoneNumber}`).get()).exists, false);
});

test('saving still rejects a conflicting card added after the pre-confirmation check', async () => {
  const db = env.authenticatedContext('site').firestore();
  await new CardPhoneValidationService({firestore: db}).validate(candidate, 'site');
  await seed({'users/other/cards/winner': {...candidate, firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo'}});
  await assert.rejects(submit(db, candidate, 'site', 'new'), (error) => error.reason === 'name-conflict');
  assert.equal((await db.doc('users/site/cards/new').get()).exists, false);
  assert.equal((await db.doc('users/site/cards/new/events/event').get()).exists, false);
});

test('real security rules allow cross-location validation and atomic card/event/guard creation', async () => {
  const db = env.authenticatedContext('site').firestore();
  await seed({'users/other/cards/existing': {...candidate, firstName: 'Emdond', lastName: 'Mbadu 2'}});
  await submit(db, candidate, 'site', 'new');
  assert.equal((await db.doc('users/site/cards/new').get()).data().phoneNumber, candidate.phoneNumber);
  assert.equal((await db.doc('users/site/cards/new/events/event').get()).data().type, 'card_created');
  assert.deepEqual((await db.doc(guardPath).get()).data().cardPaths.sort(), ['users/other/cards/existing', 'users/site/cards/new']);
});

test('simultaneous unused-number submissions with different names produce exactly one card and event', async () => {
  const barrier = simultaneousBarrier();
  const results = await Promise.allSettled([
    submit(env.authenticatedContext('site').firestore(), candidate, 'site', 'a', undefined, barrier),
    submit(env.authenticatedContext('other').firestore(), {...candidate, firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo'}, 'other', 'b', undefined, barrier),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failure = results.find((result) => result.status === 'rejected').reason;
  assert.ok(failure instanceof CardPhoneValidationError);
  assert.equal(failure.reason, 'name-conflict');
  const cards = await allCards();
  assert.equal(cards.length, 1);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    assert.equal((await db.collectionGroup('events').get()).size, 1);
    assert.deepEqual((await db.doc(guardPath).get()).data().cardPaths, [cards[0].ref.path]);
  });
});

test('simultaneous submissions sharing one name both succeed and retain both claims', async () => {
  const barrier = simultaneousBarrier();
  await Promise.all([
    submit(env.authenticatedContext('site').firestore(), candidate, 'site', 'a', undefined, barrier),
    submit(env.authenticatedContext('other').firestore(), {...candidate, firstName: 'Emdond', middleName: 'Other', lastName: 'Mbadu 2'}, 'other', 'b', undefined, barrier),
  ]);
  assert.equal((await allCards()).length, 2);
  const db = env.authenticatedContext('site').firestore();
  assert.deepEqual((await db.doc(guardPath).get()).data().cardPaths.sort(), ['users/other/cards/b', 'users/site/cards/a']);
});

test('an employee phone at another location rejects renewal without changing the card or creating an event', async () => {
  const original = {...candidate, cardCycle: '2', payments: {'10-1-2026': '10000'}};
  await seed({'users/site/cards/renew': original, 'users/other/employees/agent': {...candidate, phoneNumber: '+243 812 345 678'}});
  const db = env.authenticatedContext('site').firestore();
  await assert.rejects(submit(db, {...candidate, cardCycle: '3'}, 'site', 'renew', 'renew'), (error) => error.reason === 'employee-phone');
  assert.deepEqual((await db.doc('users/site/cards/renew').get()).data(), original);
  assert.equal((await db.collection('users/site/cards/renew/events').get()).size, 0);
  assert.equal((await db.doc(guardPath).get()).exists, false);
});

test('renewal excludes itself and ignores stale claims after a phone change', async () => {
  await seed({
    'users/site/cards/renew': {...candidate, firstName: 'Old', middleName: 'Different', lastName: 'Names'},
    'users/other/cards/changed': {...candidate, firstName: 'Sarah', phoneNumber: '0893258653'},
    [guardPath]: {cardPaths: ['users/site/cards/renew', 'users/other/cards/changed', 'users/other/cards/deleted']},
  });
  const db = env.authenticatedContext('site').firestore();
  await submit(db, {...candidate, cardCycle: '3'}, 'site', 'renew', 'renew');
  assert.equal((await db.doc('users/site/cards/renew').get()).data().cardCycle, '3');
  assert.deepEqual((await db.doc(guardPath).get()).data().cardPaths, ['users/site/cards/renew']);
});

test('public and portal clients cannot read or write phone guards', async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('portal', {portalClient: true})]) {
    const ref = context.firestore().doc(guardPath);
    await assertFails(ref.get());
    await assertFails(ref.set({cardPaths: []}));
  }
});
