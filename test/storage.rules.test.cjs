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
    await context.firestore().doc('users/admin-user').set({
      admin: 'true',
      roles: ['admin'],
    });
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
  ];

  for (const [objectPath, contentType] of operationalUploads) {
    await assertSucceeds(
      upload(staff, objectPath, new Uint8Array([1, 2, 3]), contentType)
    );
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

test('only an app admin can run the dayTotals collection-group query', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc('users/site-1/employees/employee-1/dayTotals/8-22-2026')
      .set({ dayKey: '8-22-2026', total: 1000, count: 1 });
  });

  const admin = testEnv.authenticatedContext('admin-user');
  const staff = testEnv.authenticatedContext('staff-user');
  const portalClient = testEnv.authenticatedContext('portal-user', {
    portalClient: true,
  });
  const queryFor = (context) =>
    context
      .firestore()
      .collectionGroup('dayTotals')
      .where('dayKey', '==', '8-22-2026')
      .get();

  await assertSucceeds(queryFor(admin));
  await assertFails(queryFor(staff));
  await assertFails(queryFor(portalClient));
});
