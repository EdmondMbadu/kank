# Attendance photo duplicate detection

## Scope and decision rule

- Visual matching is limited to all employees under the authenticated site.
- Near-exact visual matching uses a rolling 31-day window.
- Exact uploaded-byte matches remain detectable for all history through a small
  SHA-256 index.
- A photo is automatically classified as an anomaly only when it is either an
  exact byte match or a very high-confidence near-exact visual match.
- A wider `possibleReuse` result is retained for audit purposes but does not
  automatically penalize an employee. This is intentional because normal
  photos repeatedly show the same workplace.
- EXIF timestamps remain useful for the immediate date warning, but they are
  never trusted as evidence that a picture is new.

The near-exact rule requires agreement from two independent 64-bit perceptual
hashes plus a 64x64 luminance comparison. Locality buckets only shortlist
candidates; they never decide the verdict. This keeps Firestore reads bounded
without weakening the final comparison.

## Upload flow

1. The browser prepares the existing small attendance JPEG and starts the
   upload as soon as the user selects it.
2. The existing EXIF/date check runs locally and displays a warning before the
   user can submit.
3. As soon as Storage finishes, the authenticated verification callable checks
   the image in the background while the employee reviews the preview.
4. Confirmation waits only if that background check has not completed.
5. A second authenticated callable atomically commits the attendance, proof,
   fingerprint, and exact-hash index. A duplicate is authoritatively saved as
   `F`, regardless of the client-requested status.

Unconfirmed uploads are not added to the searchable history, so abandoning a
modal cannot create a false duplicate later. Exact-hash uniqueness is checked
again inside the final transaction to close simultaneous cross-employee races.

## Retention and cost controls

- No AI or external image-analysis API is used.
- There are no warm instances and no all-site image scans.
- Candidate lookup uses two parallel, highly selective Firestore queries with
  a 40-document cap per query.
- Large fingerprints expire after 35 days through the `expiresAt` TTL policy in
  `firestore.indexes.json`. The four-day buffer covers Firestore TTL's normal
  deletion delay beyond the 31-day matching window.
- A normal unique submission uses approximately two callable invocations,
  nine Firestore reads (including empty-query minimums), six writes, and one
  eventual TTL delete. Returned candidate documents add reads only when a
  locality bucket actually matches.

Using the September 2026 default Firestore rates for `nam5`, 1,000 employees
submitting 22 photos per month would add roughly $0.18/month in Firestore
operations if every operation were billable. It will often be covered by the
project's daily free quotas. Functions invocations at that volume are well
inside the listed two-million-invocation monthly no-cost allowance. Existing
project usage still determines whether free quota is available.

## Required staged rollout

Do not publish the employee UI before the indexes, functions, and 31-day
history are ready.

1. Deploy the composite index and TTL policy:

   ```sh
   firebase deploy --only firestore:indexes --project kank-4bbbc
   ```

2. Wait until the index and TTL field configuration report `READY`, then deploy
   the two callables:

   ```sh
   firebase deploy --only functions:verifyAttendancePhoto,functions:finalizeVerifiedAttendance --project kank-4bbbc
   ```

3. Inventory each site first. This is a dry run and does not create
   fingerprints:

   ```sh
   npm --prefix functions run attendance-photo:backfill -- --site SITE_ID --project kank-4bbbc
   ```

4. Generate the previous 31 days of fingerprints for that site:

   ```sh
   npm --prefix functions run attendance-photo:backfill -- --site SITE_ID --project kank-4bbbc --apply
   ```

5. Confirm that the backfill reports zero failures for every enforced site,
   then deploy Hosting.

The backfill understands all three historical proof shapes: the current
attendance-day `proof`, its `attachments` subcollection, and the legacy
employee `attendanceAttachments` map. Failures are listed without changing old
attendance statuses.

## Operational caveat

No image-only system can prove that two pixel-identical views of a completely
unchanged place were captured at different times. The conservative threshold
therefore favors avoiding false accusations. Exact copies, metadata-only
changes, JPEG recompression, resizing, and mild brightness edits are covered;
larger crops, overlays, or perspective changes may be retained only as
`possibleReuse` rather than automatically marked anomalous. If stronger proof
is later required, the next step should be an in-app live-camera challenge with
a server nonce, not a looser similarity threshold.
