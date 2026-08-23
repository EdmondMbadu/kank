export type FirestoreV2ProjectionItem = {
  id: string;
  sourcePath: string;
  field: string;
  legacyKey: string;
  fingerprint: string;
  sourceUpdateTimeMs?: number;
  ordinal?: number;
  deleted?: boolean;
  payloadEncoding?: string;
  value?: unknown;
};

export type FirestoreV2ProjectionDocument = {
  items?: Record<string, FirestoreV2ProjectionItem>;
};

export type FirestoreV2CompactProjectionDocument = {
  maps?: Record<string, Record<string, unknown>>;
  arrays?: Record<
    string,
    Record<string, { ordinal?: number; value?: unknown }>
  >;
};

type Layout = { mapFields: string[]; arrayFields: string[] };

const layouts: Record<string, Layout> = {
  management: {
    mapFields: [
      'moneyInHandsActivities', 'expenses', 'otherExpenses', 'fraudes',
      'reserve', 'investment', 'moneyGiven', 'exchangeLoss',
      'dollarTransferLoss', 'bankDepositDollars', 'bankDepositFrancs',
      'budgetedExpenses', 'moneyInHandsTracking', 'monthlyPaymentSnapshots',
    ],
    arrayFields: ['weeklyPaymentTargetPeriods', 'weeklyDeductionTargetVersions'],
  },
  user: {
    mapFields: [
      'investments', 'investmentsDollar', 'performances', 'expenses',
      'losses', 'reserve', 'reserveinDollar', 'feesData',
      'dailyMoneyRequests', 'dailyLending', 'dailySaving',
      'dailySavingReturns', 'dailyFeesReturns', 'dailyReimbursement',
      'dailySavingsToPayment', 'dailyMobileMoneyPayment',
      'dailyCardPayments', 'dailyCardReturns', 'dailyCardBenefits',
    ],
    arrayFields: ['reviews', 'weeklyPaymentTargetPeriods'],
  },
  employee: {
    mapFields: [
      'dailyPoints', 'payments', 'totalDailyPoints', 'dailyStatus',
      'attendance', 'attendanceAttachments', 'investigationPerformanceMonthly',
    ],
    arrayFields: [
      'paymentsPicturePath', 'receipts', 'paymentObjectiveWeekDeductions',
      'paymentObjectiveWeekBonuses', 'bestTeamTrophies',
      'bestEmployeeTrophies', 'foundationRequests',
      'foundationMonthDeductions', 'foundationManualBonuses',
    ],
  },
  client: {
    mapFields: [
      'membershipFeePayments', 'applicationFeePayments', 'payments',
      'paymentSources', 'previousPayments', 'previousPaymentSources',
      'previousSavingsPayments', 'savingsPayments', 'galleryPictures',
      'bonusHistory', 'trophyAwards', 'recoveredAwayDebts',
    ],
    arrayFields: ['comments', 'previousHomePictures', 'auditConversationAudios'],
  },
  card: {
    mapFields: ['payments', 'withdrawal', 'galleryPictures'],
    arrayFields: [],
  },
  review: { mapFields: [], arrayFields: ['reviews'] },
  certificate: { mapFields: [], arrayFields: ['certificate'] },
  gallery: { mapFields: ['galleryPictures'], arrayFields: [] },
  audit: { mapFields: [], arrayFields: ['pendingClients'] },
};

function kindForPath(sourcePath: string): string | null {
  const parts = sourcePath.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'management') return 'management';
  if (parts.length === 2 && parts[0] === 'users') return 'user';
  if (parts.length === 4 && parts[0] === 'users') {
    const byCollection: Record<string, string> = {
      employees: 'employee', clients: 'client', cards: 'card', reviews: 'review',
    };
    return byCollection[parts[2]] ?? null;
  }
  return parts.length === 2 && layouts[parts[0]] ? parts[0] : null;
}

export function flattenLatestProjectionItems(
  sourcePath: string,
  documents: FirestoreV2ProjectionDocument[]
): FirestoreV2ProjectionItem[] {
  const latest = new Map<string, FirestoreV2ProjectionItem>();
  for (const document of documents) {
    for (const item of Object.values(document.items ?? {})) {
      if (!item || item.sourcePath !== sourcePath || !item.id) continue;
      const current = latest.get(item.id);
      const currentVersion = Number(current?.sourceUpdateTimeMs ?? 0);
      const candidateVersion = Number(item.sourceUpdateTimeMs ?? 0);
      if (!current || candidateVersion > currentVersion ||
          (candidateVersion === currentVersion && item.deleted === true &&
            current.deleted !== true)) {
        latest.set(item.id, item);
      }
    }
  }
  return Array.from(latest.values());
}

export function reconstructLegacyDocument<T extends Record<string, any>>(
  sourcePath: string,
  projectionDocuments: FirestoreV2ProjectionDocument[],
  baseData: T
): T {
  const kind = kindForPath(sourcePath);
  if (!kind) return { ...baseData };
  const layout = layouts[kind];
  const mapFields = new Set(layout.mapFields);
  const arrayFields = new Set(layout.arrayFields);
  const result: Record<string, any> = { ...baseData };
  const arrays = new Map<string, Array<{ ordinal: number; value: unknown }>>();
  const touchedArrays = new Set<string>();

  for (const item of flattenLatestProjectionItems(sourcePath, projectionDocuments)) {
    if (item.payloadEncoding) {
      // The caller must retain the legacy document until chunk hydration is
      // implemented for that payload. Never return a partial value silently.
      continue;
    }
    if (mapFields.has(item.field)) {
      const previous = result[item.field];
      const current = previous && typeof previous === 'object' &&
        !Array.isArray(previous) ? { ...previous } : {};
      if (item.deleted === true) delete current[item.legacyKey];
      else if (Object.prototype.hasOwnProperty.call(item, 'value')) {
        current[item.legacyKey] = item.value;
      }
      result[item.field] = current;
    } else if (arrayFields.has(item.field)) {
      touchedArrays.add(item.field);
      if (item.deleted !== true &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        const current = arrays.get(item.field) ?? [];
        current.push({ ordinal: Number(item.ordinal ?? 0), value: item.value });
        arrays.set(item.field, current);
      }
    }
  }

  for (const field of touchedArrays) {
    result[field] = (arrays.get(field) ?? [])
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((item) => item.value);
  }
  return result as T;
}

export function hasChunkedProjection(
  sourcePath: string,
  documents: FirestoreV2ProjectionDocument[]
): boolean {
  return flattenLatestProjectionItems(sourcePath, documents)
    .some((item) => Boolean(item.payloadEncoding) && item.deleted !== true);
}

export function reconstructCompactLegacyDocument<
  T extends Record<string, any>
>(
  sourcePath: string,
  projectionDocuments: FirestoreV2CompactProjectionDocument[],
  baseData: T
): T {
  const kind = kindForPath(sourcePath);
  if (!kind) return { ...baseData };
  const layout = layouts[kind];
  const mapFields = new Set(layout.mapFields);
  const arrayFields = new Set(layout.arrayFields);
  const result: Record<string, any> = { ...baseData };
  const arrays = new Map<string, Array<{ ordinal: number; value: unknown }>>();
  const touchedArrays = new Set<string>();

  for (const document of projectionDocuments) {
    for (const [field, values] of Object.entries(document.maps ?? {})) {
      if (!mapFields.has(field) || !values || Array.isArray(values)) continue;
      const previous = result[field];
      result[field] = {
        ...(previous && typeof previous === 'object' && !Array.isArray(previous) ?
          previous : {}),
        ...values,
      };
    }
    for (const [field, values] of Object.entries(document.arrays ?? {})) {
      if (!arrayFields.has(field) || !values || Array.isArray(values)) continue;
      touchedArrays.add(field);
      const current = arrays.get(field) ?? [];
      for (const item of Object.values(values)) {
        if (item && Object.prototype.hasOwnProperty.call(item, 'value')) {
          current.push({ ordinal: Number(item.ordinal ?? 0), value: item.value });
        }
      }
      arrays.set(field, current);
    }
  }
  for (const field of touchedArrays) {
    result[field] = (arrays.get(field) ?? [])
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((item) => item.value);
  }
  return result as T;
}
