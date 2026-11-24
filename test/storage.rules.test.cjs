const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-kank-storage-rules';
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`;
const CANONICAL_MANAGEMENT_ID = 'CWGXCLYchpm95b3KjoDJ';
const ROOT = path.resolve(__dirname, '..');

let testEnv;

function storageFor(context) {
  return context.storage(BUCKET_URL);
}

function upload(context, objectPath, bytes, contentType) {
  return storageFor(context)
    .ref(objectPath)
    .put(bytes, { contentType });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'),
    },
  });

  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await firestore.doc('users/admin-user').set({
      admin: 'true',
      roles: ['admin'],
    });
    await firestore
      .doc(`management/${CANONICAL_MANAGEMENT_ID}`)
      .set({
        id: CANONICAL_MANAGEMENT_ID,
        moneyInHands: '100000',
        reserve: {},
      });
    await firestore.doc('management/undefined').set({
      moneyInHands: '-445000',
      reserve: { '8-26-2026-16-15-45': '135000' },
    });
    await firestore
      .doc(
        `management/${CANONICAL_MANAGEMENT_ID}/firestoreV2ReadMonths/2026-08`
      )
      .set({ monthKey: '2026-08', maps: { reserve: {} } });
  });
});

after(async () => {
  if (!testEnv) return;
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
  await testEnv.cleanup();
});

test('authenticated staff can upload every critical operational file type', async () => {
  const staff = testEnv.authenticatedContext('staff-user');
  const operationalUploads = [
    ['clients-home/client-1/house.jpg', 'image/jpeg'],
    ['client-gallery/client-1/document.jpg', 'image/jpeg'],
    ['attendance_proofs/site-1/employee-1/2026-08-16/proof.jpg', 'image/jpeg'],
    ['receipts/employee-1/payment.jpg', 'image/jpeg'],
    ['foundation-receipts/employee-1/payment.pdf', 'application/pdf'],
    ['reviews/client-1/message.webm', 'audio/webm'],
    ['audit-conversations/client-1/conversation.m4a', 'audio/mp4'],
  ];

  for (const [objectPath, contentType] of operationalUploads) {
    await assertSucceeds(
      upload(staff, objectPath, new Uint8Array([1, 2, 3]), contentType)
    );
  }
});

test('audit audio byte fallback works with the AngularFire Firebase version and staff rules', async () => {
  const assert = require('node:assert/strict');
  const { createRequire, Module } = require('node:module');
  const ts = require('typescript');
  const { File } = require('node:buffer');
  const sourcePath = path.join(ROOT, 'src/app/utils/audit-audio-upload.util.ts');
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  loaded._compile(compiled.outputText, sourcePath);

  // Use the actual Firebase 9 instance that AngularFire wraps, while the
  // helper imports uploadBytes from the app's Firebase 10 dependency.
  const afRequire = createRequire(path.join(ROOT, 'node_modules/@angular/fire/package.json'));
  const compat = afRequire('firebase/compat/app');
  afRequire('firebase/compat/storage');
  const { connectStorageEmulator } = afRequire('firebase/storage');
  const app = compat.initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` }, 'audit-audio-emulator');
  const storage = app.storage();
  const [host, port] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
  connectStorageEmulator(storage._delegate, host, Number(port), { mockUserToken: { sub: 'staff-user' } });
  try {
    const protocols = [];
    const nativeRequest = storage._delegate.makeRequestWithTokens.bind(storage._delegate);
    storage._delegate.makeRequestWithTokens = (request, ...rest) => {
      protocols.push(request.headers['X-Goog-Upload-Protocol']);
      return nativeRequest(request, ...rest);
    };
    const result = await loaded.exports.uploadAuditAudioBytes(
      { storage }, 'audit-conversations/client-1/iphone-fallback.m4a',
      new File([new Uint8Array(632389)], 'Enregistrement d’appel.m4a', { type: 'audio/mp4' }),
      { contentType: 'audio/mp4', customMetadata: { fileName: 'Enregistrement d’appel.m4a', debtCycle: '3' } }
    );
    const metadata = await result.ref.getMetadata();
    assert.equal(metadata.size, 632389);
    assert.equal(metadata.contentType, 'audio/mp4');
    assert.equal(metadata.customMetadata.debtCycle, '3');
    assert.match(await result.ref.getDownloadURL(), /alt=media/);
    assert.ok(protocols.includes('multipart'));
    assert.ok(!protocols.includes('resumable'));
  } finally {
    await app.delete();
  }
});

test('unauthenticated and portal-client users cannot upload operational files', async () => {
  const unauthenticated = testEnv.unauthenticatedContext();
  const portalClient = testEnv.authenticatedContext('portal-user', {
    portalClient: true,
    ownerUid: 'staff-user',
    clientUid: 'client-1',
  });

  await assertFails(
    upload(
      unauthenticated,
      'clients-home/blocked-unauthenticated.jpg',
      new Uint8Array([1]),
      'image/jpeg'
    )
  );
  await assertFails(
    upload(
      portalClient,
      'clients-home/blocked-portal-client.jpg',
      new Uint8Array([1]),
      'image/jpeg'
    )
  );
});

test('only an app admin can create, replace, or delete investigation PDFs', async () => {
  const admin = testEnv.authenticatedContext('admin-user');
  const staff = testEnv.authenticatedContext('staff-user');
  const objectPath = 'investigation-documents/document-1/v1-mise-en-demeure.pdf';

  await assertFails(
    upload(staff, objectPath, new Uint8Array([1]), 'application/pdf')
  );
  await assertSucceeds(
    upload(admin, objectPath, new Uint8Array([1, 2]), 'application/pdf')
  );
  await assertFails(
    upload(staff, objectPath, new Uint8Array([3]), 'application/pdf')
  );
  await assertFails(storageFor(staff).ref(objectPath).delete());
  await assertSucceeds(storageFor(admin).ref(objectPath).delete());
});

test('investigation uploads reject non-PDF files and files over 20 MiB', async () => {
  const admin = testEnv.authenticatedContext('admin-user');

  await assertFails(
    upload(
      admin,
      'investigation-documents/document-2/not-a-pdf.jpg',
      new Uint8Array([1]),
      'image/jpeg'
    )
  );
  await assertFails(
    upload(
      admin,
      'investigation-documents/document-3/too-large.pdf',
      new Uint8Array(20 * 1024 * 1024 + 1),
      'application/pdf'
    )
  );
});

test('staff can read investigation PDFs while portal clients cannot', async () => {
  const admin = testEnv.authenticatedContext('admin-user');
  const staff = testEnv.authenticatedContext('staff-user');
  const portalClient = testEnv.authenticatedContext('portal-user', {
    portalClient: true,
  });
  const objectPath = 'investigation-documents/document-4/guide.pdf';

  await assertSucceeds(
    upload(admin, objectPath, new Uint8Array([1, 2, 3]), 'application/pdf')
  );
  await assertSucceeds(storageFor(staff).ref(objectPath).getMetadata());
  await assertFails(storageFor(portalClient).ref(objectPath).getMetadata());
});

test('investigation staff can update a client profession without changing financial fields', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc('users/site-1/clients/client-1')
      .set({
        profession: 'Commerce',
        loanAmount: '100000',
      });
  });

  const staff = testEnv.authenticatedContext('staff-user').firestore();
  const portal = testEnv
    .authenticatedContext('portal-user', {
      portalClient: true,
      ownerUid: 'site-1',
      clientUid: 'client-1',
    })
    .firestore();
  const clientPath = 'users/site-1/clients/client-1';

  await assertSucceeds(
    staff.doc(clientPath).update({ profession: 'Vente de vêtements' })
  );
  await assertFails(staff.doc(clientPath).update({ loanAmount: '50000' }));
  await assertFails(
    portal.doc(clientPath).update({ profession: 'Vente de chaussures' })
  );
});

test('authenticated staff can run dayTotals collection-group queries', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc('users/site-1/employees/employee-1/dayTotals/8-22-2026')
      .set({
        dayKey: '8-22-2026',
        monthKey: '2026-08',
        total: 1000,
        count: 1,
      });
  });

  const admin = testEnv.authenticatedContext('admin-user');
  const staff = testEnv.authenticatedContext('staff-user');
  const unauthenticated = testEnv.unauthenticatedContext();
  const portalClient = testEnv.authenticatedContext('portal-user', {
    portalClient: true,
  });
  const queryFor = (firestore) =>
    firestore
      .collectionGroup('dayTotals')
      .where('dayKey', '==', '8-22-2026')
      .get();
  const monthQueryFor = (firestore) =>
    firestore
      .collectionGroup('dayTotals')
      .where('monthKey', '==', '2026-08')
      .get();
  const adminFirestore = admin.firestore();
  const staffFirestore = staff.firestore();
  const unauthenticatedFirestore = unauthenticated.firestore();
  const portalFirestore = portalClient.firestore();

  await assertSucceeds(queryFor(adminFirestore));
  await assertSucceeds(monthQueryFor(adminFirestore));
  await assertSucceeds(queryFor(staffFirestore));
  await assertSucceeds(monthQueryFor(staffFirestore));
  await assertFails(queryFor(unauthenticatedFirestore));
  await assertFails(monthQueryFor(unauthenticatedFirestore));
  await assertFails(queryFor(portalFirestore));
  await assertFails(monthQueryFor(portalFirestore));
});

test('authenticated staff can read immutable month-end remaining-loan snapshots', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc('remainingLoanMonthEnds/2026-08')
      .set({
        periodKey: '2026-08',
        totalDebtLeftFc: 100000,
      });
  });

  const admin = testEnv.authenticatedContext('admin-user').firestore();
  const staff = testEnv.authenticatedContext('staff-user').firestore();
  const portal = testEnv
    .authenticatedContext('portal-user', { portalClient: true })
    .firestore();
  const path = 'remainingLoanMonthEnds/2026-08';

  await assertSucceeds(admin.doc(path).get());
  await assertSucceeds(staff.doc(path).get());
  await assertFails(portal.doc(path).get());
  await assertFails(
    staff.doc(path).set({ totalDebtLeftFc: 200000 })
  );
  await assertFails(admin.doc(path).set({ totalDebtLeftFc: 200000 }));
});

test('staff can update only the canonical management ledger', async () => {
  const staff = testEnv.authenticatedContext('staff-user').firestore();
  const canonical = staff.doc(`management/${CANONICAL_MANAGEMENT_ID}`);

  await assertSucceeds(canonical.get());
  await assertSucceeds(staff.collection('management').get());
  await assertSucceeds(
    canonical.set(
      { reserve: { '8-26-2026-16-15-45': '135000' } },
      { merge: true }
    )
  );
  await assertFails(
    staff.doc('management/undefined').set({
      reserve: { '8-26-2026-16-15-45': '135000' },
    })
  );
  await assertFails(
    staff.doc('management/another-ledger').set({ moneyInHands: '0' })
  );
});

test('staff can continue updating the existing exchange-rate settings', async () => {
  const staff = testEnv.authenticatedContext('staff-user').firestore();

  await assertSucceeds(
    staff.doc('management/singleton').set({
      rateDollar: 2900,
      rateFranc: 0.00034,
    })
  );
});

test('staff can read canonical v2 projections but cannot write them', async () => {
  const staff = testEnv.authenticatedContext('staff-user').firestore();
  const projection = staff.doc(
    `management/${CANONICAL_MANAGEMENT_ID}/firestoreV2ReadMonths/2026-08`
  );

  await assertSucceeds(projection.get());
  await assertFails(projection.set({ monthKey: 'tampered' }, { merge: true }));
});

test('portal and unauthenticated sessions cannot read management data', async () => {
  const portal = testEnv
    .authenticatedContext('portal-user', { portalClient: true })
    .firestore();
  const unauthenticated = testEnv.unauthenticatedContext().firestore();
  const path = `management/${CANONICAL_MANAGEMENT_ID}`;

  await assertFails(portal.doc(path).get());
  await assertFails(unauthenticated.doc(path).get());
});
