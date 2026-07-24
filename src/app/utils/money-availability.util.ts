export type MoneyAvailabilityTier = 'best' | 'standard' | 'building';
export type BestClientLevel = 'Gold' | 'Silver' | null;

export interface MoneyAvailability {
  score: number;
  tier: MoneyAvailabilityTier;
  bestClientLevel: BestClientLevel;
  earliestDate: Date;
  earliestDateIso: string;
}

const SUNDAY = 0;

function localDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addOpenDays(value: Date, numberOfDays: number): Date {
  const result = localDateOnly(value);
  let openDaysAdded = 0;

  while (openDaysAdded < numberOfDays) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== SUNDAY) {
      openDaysAdded += 1;
    }
  }

  return result;
}

function sameDayNextWeek(value: Date): Date {
  const result = localDateOnly(value);
  result.setDate(result.getDate() + 7);

  // Requests are normally made Monday–Saturday. Keep a defensive fallback
  // in case a request is ever created on the closed day.
  if (result.getDay() === SUNDAY) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

export function toLocalDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function getMoneyAvailability(
  rawScore: number,
  requestDate: Date = new Date()
): MoneyAvailability {
  const score = Number.isFinite(rawScore) ? rawScore : 50;
  let earliestDate: Date;
  let tier: MoneyAvailabilityTier;
  let bestClientLevel: BestClientLevel = null;

  if (score >= 70) {
    tier = 'best';
    bestClientLevel = score >= 100 ? 'Gold' : 'Silver';
    earliestDate = addOpenDays(requestDate, 1);
  } else if (score >= 50) {
    tier = 'standard';
    earliestDate = addOpenDays(requestDate, 3);
  } else {
    tier = 'building';
    earliestDate = sameDayNextWeek(requestDate);
  }

  return {
    score,
    tier,
    bestClientLevel,
    earliestDate,
    earliestDateIso: toLocalDateInputValue(earliestDate),
  };
}

export function isMoneyDeliveryDateAllowed(
  selectedDateIso: string,
  earliestDateIso: string
): boolean {
  const selectedDate = parseLocalDateInput(selectedDateIso);
  const earliestDate = parseLocalDateInput(earliestDateIso);

  return !!selectedDate && !!earliestDate && selectedDate >= earliestDate;
}

export function enforceEarliestMoneyDeliveryDate(
  selectedDateIso: string,
  earliestDateIso: string
): string {
  if (!selectedDateIso) {
    return earliestDateIso;
  }

  return isMoneyDeliveryDateAllowed(selectedDateIso, earliestDateIso)
    ? selectedDateIso
    : earliestDateIso;
}

export function formatMoneyAvailabilityDate(value: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}
