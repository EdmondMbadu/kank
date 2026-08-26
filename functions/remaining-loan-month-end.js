"use strict";
/* eslint-disable require-jsdoc */

const SNAPSHOT_COLLECTION = "remainingLoanMonthEnds";
const SNAPSHOT_DEFINITION_VERSION = "active-contractual-debt-v1";
const SNAPSHOT_TIME_ZONE = "Africa/Kinshasa";

function finiteNonNegative(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isActiveRemainingLoan(client) {
  const status = String(client && client.vitalStatus || "")
      .trim()
      .toLowerCase();
  return (status === "" || status === "vivant") &&
    finiteNonNegative(client && client.debtLeft) > 0;
}

function clientStableKey(client) {
  return String(
      client.uid ||
      client.trackingId ||
      client.clientId ||
      [client.firstName, client.lastName, client.phoneNumber]
          .map((value) => String(value || "").trim().toLowerCase())
          .join("|"),
  );
}

function timestampMillis(value) {
  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function preferClientCandidate(current, candidate) {
  const currentUpdatedAt = timestampMillis(
      current.updatedAt || current.lastUpdatedAt || current.modifiedAt,
  );
  const candidateUpdatedAt = timestampMillis(
      candidate.updatedAt || candidate.lastUpdatedAt || candidate.modifiedAt,
  );
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt ? candidate : current;
  }

  const currentOwnerMatches = current.locationOwnerId === current.ownerUid;
  const candidateOwnerMatches =
    candidate.locationOwnerId === candidate.ownerUid;
  if (candidateOwnerMatches !== currentOwnerMatches) {
    return candidateOwnerMatches ? candidate : current;
  }

  const pathComparison = String(candidate.path || "")
      .localeCompare(String(current.path || ""));
  return pathComparison < 0 ? candidate : current;
}

function percentageChange(current, previous) {
  const previousAmount = finiteNonNegative(previous);
  if (previousAmount <= 0) return null;
  return ((finiteNonNegative(current) - previousAmount) / previousAmount) * 100;
}

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function previousPeriod(year, month) {
  return month === 1 ?
    {year: year - 1, month: 12} :
    {year, month: month - 1};
}

function closingDate(year, month) {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${periodKey(year, month)}-${String(day).padStart(2, "0")}`;
}

function kinshasaYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const values = parts.reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return {year: Number(values.year), month: Number(values.month)};
}

function snapshotPeriodAtRollover(now = new Date()) {
  const current = kinshasaYearMonth(now);
  return previousPeriod(current.year, current.month);
}

function buildRemainingLoanMonthEndSnapshot({
  year,
  month,
  sites,
  clients,
  previousSnapshot,
}) {
  const siteById = new Map(sites.map((site) => [site.ownerUid, site]));
  const uniqueClients = new Map();
  let duplicateClientCount = 0;

  clients.forEach((client) => {
    if (!siteById.has(client.ownerUid)) return;
    const key = clientStableKey(client);
    const current = uniqueClients.get(key);
    if (current) {
      duplicateClientCount += 1;
      uniqueClients.set(key, preferClientCandidate(current, client));
    } else {
      uniqueClients.set(key, client);
    }
  });

  const totalsBySite = new Map(sites.map((site) => [site.ownerUid, {
    debtLeftFc: 0,
    activeClientCount: 0,
  }]));

  uniqueClients.forEach((client) => {
    if (!isActiveRemainingLoan(client)) return;
    const total = totalsBySite.get(client.ownerUid);
    if (!total) return;
    total.debtLeftFc += finiteNonNegative(client.debtLeft);
    total.activeClientCount += 1;
  });

  const previousSites = new Map(
      (previousSnapshot && previousSnapshot.sites || [])
          .map((site) => [site.ownerUid, site]),
  );
  const totalDebtLeftFc = Array.from(totalsBySite.values())
      .reduce((sum, site) => sum + site.debtLeftFc, 0);

  const snapshotSites = sites.map((site) => {
    const total = totalsBySite.get(site.ownerUid);
    const previousClosingFc = finiteNonNegative(
        previousSites.get(site.ownerUid) &&
        previousSites.get(site.ownerUid).debtLeftFc,
    );
    return {
      ownerUid: site.ownerUid,
      siteName: site.siteName,
      debtLeftFc: total.debtLeftFc,
      activeClientCount: total.activeClientCount,
      sharePercent: totalDebtLeftFc > 0 ?
        (total.debtLeftFc / totalDebtLeftFc) * 100 : 0,
      previousClosingFc,
      growthPercent: percentageChange(total.debtLeftFc, previousClosingFc),
    };
  }).sort((a, b) =>
    b.debtLeftFc - a.debtLeftFc || a.siteName.localeCompare(b.siteName),
  );

  const previousClosingFc = finiteNonNegative(
      previousSnapshot && previousSnapshot.totalDebtLeftFc,
  );

  return {
    periodKey: periodKey(year, month),
    month,
    year,
    status: "final",
    timeZone: SNAPSHOT_TIME_ZONE,
    closingDate: closingDate(year, month),
    definitionVersion: SNAPSHOT_DEFINITION_VERSION,
    totalDebtLeftFc,
    activeClientCount: snapshotSites.reduce(
        (sum, site) => sum + site.activeClientCount,
        0,
    ),
    siteCount: snapshotSites.length,
    previousClosingFc,
    growthPercent: percentageChange(totalDebtLeftFc, previousClosingFc),
    duplicateClientCount,
    clientDocumentCount: clients.length,
    sites: snapshotSites,
  };
}

async function captureRemainingLoanMonthEnd({
  db,
  fieldValue,
  now = new Date(),
}) {
  const target = snapshotPeriodAtRollover(now);
  const targetKey = periodKey(target.year, target.month);
  const snapshotRef = db.collection(SNAPSHOT_COLLECTION).doc(targetKey);
  const existing = await snapshotRef.get();
  if (existing.exists) {
    return {created: false, periodKey: targetKey, reason: "already-exists"};
  }

  const usersSnapshot = await db.collection("users")
      .where("mode", "!=", "testing")
      .get();
  const sites = usersSnapshot.docs.map((document) => {
    const user = document.data() || {};
    return {
      ownerUid: document.id,
      siteName: String(user.firstName || user.lastName || "Site"),
    };
  });
  const productionOwnerIds = new Set(sites.map((site) => site.ownerUid));

  const clientsSnapshot = await db.collectionGroup("clients").get();
  const clients = [];
  clientsSnapshot.docs.forEach((document) => {
    const pathParts = document.ref.path.split("/");
    const isTopLevelClient = pathParts.length === 4 &&
      pathParts[0] === "users" && pathParts[2] === "clients";
    const ownerUid = isTopLevelClient ? pathParts[1] : "";
    if (!productionOwnerIds.has(ownerUid)) return;
    clients.push({
      ...document.data(),
      clientId: document.id,
      ownerUid,
      path: document.ref.path,
    });
  });

  const previous = previousPeriod(target.year, target.month);
  const previousDoc = await db.collection(SNAPSHOT_COLLECTION)
      .doc(periodKey(previous.year, previous.month))
      .get();
  const snapshot = buildRemainingLoanMonthEndSnapshot({
    ...target,
    sites,
    clients,
    previousSnapshot: previousDoc.exists ? previousDoc.data() : null,
  });

  try {
    await snapshotRef.create({
      ...snapshot,
      capturedAt: fieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error && (error.code === 6 || error.code === "already-exists")) {
      return {created: false, periodKey: targetKey, reason: "already-exists"};
    }
    throw error;
  }

  return {
    created: true,
    periodKey: targetKey,
    totalDebtLeftFc: snapshot.totalDebtLeftFc,
    activeClientCount: snapshot.activeClientCount,
    siteCount: snapshot.siteCount,
    duplicateClientCount: snapshot.duplicateClientCount,
  };
}

module.exports = {
  SNAPSHOT_COLLECTION,
  SNAPSHOT_DEFINITION_VERSION,
  SNAPSHOT_TIME_ZONE,
  buildRemainingLoanMonthEndSnapshot,
  captureRemainingLoanMonthEnd,
  closingDate,
  isActiveRemainingLoan,
  periodKey,
  previousPeriod,
  snapshotPeriodAtRollover,
};
