import { Client } from 'src/app/models/client';

export type PaymentReminderProjectionSendMode = 'all' | 'excludeQuitte';

export type PaymentReminderProjectionClient = {
  client: Client;
  key: string;
  locationName: string;
  debt: number;
  expectedPayment: number;
  isQuitte: boolean;
  hasValidPhone: boolean;
  isTargeted: boolean;
  exclusionLabel: string | null;
};

export type PaymentReminderProjectionSite = {
  key: string;
  locationName: string;
  clients: PaymentReminderProjectionClient[];
  clientCount: number;
  targetCount: number;
  debtTotal: number;
  expectedPaymentTotal: number;
};

export type PaymentReminderProjection = {
  selectedWeekday: string;
  locationFilter: string;
  allLocations: string[];
  clients: PaymentReminderProjectionClient[];
  targetClients: Client[];
  sites: PaymentReminderProjectionSite[];
  totalClients: number;
  targetCount: number;
  siteCount: number;
  debtTotal: number;
  expectedPaymentTotal: number;
  quitteCount: number;
  excludedQuitteCount: number;
  invalidPhoneCount: number;
};

type PaymentReminderProjectionOptions = {
  dateKey: string;
  sendMode: PaymentReminderProjectionSendMode;
  locationFilter?: string;
  isQuitte: (client: Client) => boolean;
  expectedPayment: (client: Client) => number;
};

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const FRENCH_WEEKDAYS: Record<string, string> = {
  dimanche: 'Sunday',
  lundi: 'Monday',
  mardi: 'Tuesday',
  mercredi: 'Wednesday',
  jeudi: 'Thursday',
  vendredi: 'Friday',
  samedi: 'Saturday',
};

export function emptyPaymentReminderProjection(): PaymentReminderProjection {
  return {
    selectedWeekday: '',
    locationFilter: 'all',
    allLocations: [],
    clients: [],
    targetClients: [],
    sites: [],
    totalClients: 0,
    targetCount: 0,
    siteCount: 0,
    debtTotal: 0,
    expectedPaymentTotal: 0,
    quitteCount: 0,
    excludedQuitteCount: 0,
    invalidPhoneCount: 0,
  };
}

export function buildPaymentReminderProjection(
  clients: Client[] | null | undefined,
  options: PaymentReminderProjectionOptions
): PaymentReminderProjection {
  const targetDate = parseDateKey(options.dateKey);
  if (!targetDate || !Array.isArray(clients)) {
    return emptyPaymentReminderProjection();
  }

  const selectedWeekday = WEEKDAYS[targetDate.getDay()];
  const cycleCutoff = new Date(targetDate);
  cycleCutoff.setDate(cycleCutoff.getDate() - 6);

  const allRows = clients
    .filter((client) => parseMoney(client.debtLeft) > 0)
    .filter(
      (client) => normalizePaymentDay(client.paymentDay) === selectedWeekday
    )
    .filter((client) => {
      const startDate = parseClientDate(client.debtCycleStartDate);
      return !startDate || startDate <= cycleCutoff;
    })
    .map((client, index): PaymentReminderProjectionClient => {
      const isQuitte = options.isQuitte(client);
      const hasValidPhone = isReminderPhoneValid(client);
      const isTargeted =
        hasValidPhone &&
        (options.sendMode === 'all' || !isQuitte);
      const expectedPayment = Math.max(
        Number(options.expectedPayment(client)) || 0,
        0
      );

      return {
        client,
        key:
          client.uid ||
          client.trackingId ||
          `${client.firstName || ''}-${client.lastName || ''}-${
            client.phoneNumber || index
          }`,
        locationName:
          (client.locationName || 'Site non indiqué').trim() ||
          'Site non indiqué',
        debt: parseMoney(client.debtLeft),
        expectedPayment,
        isQuitte,
        hasValidPhone,
        isTargeted,
        exclusionLabel: !hasValidPhone
          ? 'Téléphone invalide'
          : options.sendMode === 'excludeQuitte' && isQuitte
          ? 'Quitté exclu'
          : null,
      };
    });

  const allLocations = Array.from(
    new Set(allRows.map((row) => row.locationName))
  ).sort((a, b) => a.localeCompare(b, 'fr'));
  const requestedLocation = (options.locationFilter || 'all').trim();
  const locationFilter = allLocations.includes(requestedLocation)
    ? requestedLocation
    : 'all';
  const rows =
    locationFilter === 'all'
      ? allRows
      : allRows.filter((row) => row.locationName === locationFilter);

  const grouped = new Map<string, PaymentReminderProjectionClient[]>();
  for (const row of rows) {
    const group = grouped.get(row.locationName) || [];
    group.push(row);
    grouped.set(row.locationName, group);
  }

  const sites = Array.from(grouped.entries())
    .map(([locationName, siteClients]): PaymentReminderProjectionSite => {
      const targeted = siteClients.filter((row) => row.isTargeted);
      return {
        key: locationName,
        locationName,
        clients: siteClients.sort(compareProjectionClients),
        clientCount: siteClients.length,
        targetCount: targeted.length,
        debtTotal: sum(targeted, (row) => row.debt),
        expectedPaymentTotal: sum(
          targeted,
          (row) => row.expectedPayment
        ),
      };
    })
    .sort((a, b) => a.locationName.localeCompare(b.locationName, 'fr'));
  const targetedRows = rows.filter((row) => row.isTargeted);

  return {
    selectedWeekday,
    locationFilter,
    allLocations,
    clients: rows,
    targetClients: targetedRows.map((row) => row.client),
    sites,
    totalClients: rows.length,
    targetCount: targetedRows.length,
    siteCount: sites.length,
    debtTotal: sum(targetedRows, (row) => row.debt),
    expectedPaymentTotal: sum(
      targetedRows,
      (row) => row.expectedPayment
    ),
    quitteCount: rows.filter((row) => row.isQuitte).length,
    excludedQuitteCount:
      options.sendMode === 'excludeQuitte'
        ? rows.filter((row) => row.isQuitte).length
        : 0,
    invalidPhoneCount: rows.filter((row) => !row.hasValidPhone).length,
  };
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function parseClientDate(value?: string | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const legacy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(raw);
    if (!legacy) return null;
    month = Number(legacy[1]);
    day = Number(legacy[2]);
    year = Number(legacy[3]);
  }

  const date = new Date(year, month - 1, day, 12);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizePaymentDay(value?: string | null): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const english = WEEKDAYS.find((day) => day.toLowerCase() === normalized);
  return english || FRENCH_WEEKDAYS[normalized] || null;
}

function parseMoney(value?: string | number | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value || '').replace(/[^0-9.-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function isReminderPhoneValid(client: Client): boolean {
  if (String(client.isPhoneCorrect || '').toLowerCase() === 'false') {
    return false;
  }
  const digits = String(client.phoneNumber || '').replace(/\D/g, '');
  return (
    (digits.startsWith('0') && digits.length > 1) ||
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith('1'))
  );
}

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function compareProjectionClients(
  a: PaymentReminderProjectionClient,
  b: PaymentReminderProjectionClient
): number {
  const aName = `${a.client.firstName || ''} ${a.client.lastName || ''}`.trim();
  const bName = `${b.client.firstName || ''} ${b.client.lastName || ''}`.trim();
  return aName.localeCompare(bName, 'fr');
}
