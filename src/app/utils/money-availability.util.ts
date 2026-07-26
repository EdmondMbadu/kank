export type MoneyAvailabilityTier = 'best' | 'standard' | 'building';
export type BestClientLevel = 'Gold' | 'Silver' | null;
export type MoneyAvailabilityPolicySource =
  | 'global'
  | 'location'
  | 'fallback';

export interface MoneyAvailabilityRule {
  id: string;
  minScore: number | null;
  maxScore: number | null;
  openDays: number;
}

export interface MoneyAvailabilityPolicy {
  version: number;
  rules: MoneyAvailabilityRule[];
  updatedAtMs?: number;
  updatedByUid?: string;
  updatedByName?: string;
}

export interface ResolvedMoneyAvailabilityPolicy {
  policy: MoneyAvailabilityPolicy;
  source: MoneyAvailabilityPolicySource;
  locationId?: string;
}

export interface MoneyAvailability {
  score: number;
  tier: MoneyAvailabilityTier;
  bestClientLevel: BestClientLevel;
  earliestDate: Date;
  earliestDateIso: string;
  openDays: number;
  ruleId: string;
  policyVersion: number;
}

export interface MoneyAvailabilityPolicySnapshot {
  version: number;
  source: MoneyAvailabilityPolicySource;
  locationId?: string;
  ruleId: string;
  minScore: number | null;
  maxScore: number | null;
  openDays: number;
  calculatedAtMs: number;
}

const SUNDAY = 0;
const MAX_CONFIGURABLE_OPEN_DAYS = 30;

export const DEFAULT_MONEY_AVAILABILITY_RULES: MoneyAvailabilityRule[] = [
  {
    id: 'building',
    minScore: null,
    maxScore: 49,
    openDays: 6,
  },
  {
    id: 'standard-50-59',
    minScore: 50,
    maxScore: 59,
    openDays: 3,
  },
  {
    id: 'standard-60-69',
    minScore: 60,
    maxScore: 69,
    openDays: 3,
  },
  {
    id: 'best',
    minScore: 70,
    maxScore: null,
    openDays: 1,
  },
];

export const DEFAULT_MONEY_AVAILABILITY_POLICY: MoneyAvailabilityPolicy = {
  version: 1,
  rules: cloneMoneyAvailabilityRules(DEFAULT_MONEY_AVAILABILITY_RULES),
};

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

function finiteIntegerOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

function normalizedRule(
  value: Partial<MoneyAvailabilityRule> | null | undefined,
  index: number
): MoneyAvailabilityRule | null {
  if (!value) {
    return null;
  }

  const minScore = finiteIntegerOrNull(value.minScore);
  const maxScore = finiteIntegerOrNull(value.maxScore);
  const openDays = Number(value.openDays);

  if (
    minScore === undefined ||
    maxScore === undefined ||
    !Number.isInteger(openDays) ||
    openDays < 0 ||
    openDays > MAX_CONFIGURABLE_OPEN_DAYS
  ) {
    return null;
  }

  return {
    id: `${value.id || `rule-${index + 1}`}`.trim() || `rule-${index + 1}`,
    minScore,
    maxScore,
    openDays,
  };
}

function ruleSortValue(rule: MoneyAvailabilityRule): number {
  return rule.minScore === null ? Number.NEGATIVE_INFINITY : rule.minScore;
}

export function cloneMoneyAvailabilityRules(
  rules: MoneyAvailabilityRule[]
): MoneyAvailabilityRule[] {
  return (rules || []).map((rule) => ({ ...rule }));
}

export function validateMoneyAvailabilityRules(
  rawRules: Array<Partial<MoneyAvailabilityRule>> | null | undefined
): string[] {
  if (!Array.isArray(rawRules) || rawRules.length === 0) {
    return ['Ajoutez au moins une règle de score.'];
  }

  const normalized = rawRules.map(normalizedRule);
  if (normalized.some((rule) => rule === null)) {
    return [
      `Chaque délai doit être un nombre entier entre 0 et ${MAX_CONFIGURABLE_OPEN_DAYS}.`,
    ];
  }

  const rules = (normalized as MoneyAvailabilityRule[]).sort(
    (a, b) => ruleSortValue(a) - ruleSortValue(b)
  );
  const errors: string[] = [];
  const ids = new Set<string>();

  rules.forEach((rule) => {
    if (ids.has(rule.id)) {
      errors.push(`L'identifiant de règle « ${rule.id} » est utilisé plusieurs fois.`);
    }
    ids.add(rule.id);

    if (
      rule.minScore !== null &&
      rule.maxScore !== null &&
      rule.minScore > rule.maxScore
    ) {
      errors.push(
        `La borne minimale ${rule.minScore} dépasse la borne maximale ${rule.maxScore}.`
      );
    }
  });

  if (rules[0].minScore !== null) {
    errors.push('La première règle doit couvrir tous les scores inférieurs.');
  }

  if (rules[rules.length - 1].maxScore !== null) {
    errors.push('La dernière règle doit couvrir tous les scores supérieurs.');
  }

  for (let index = 1; index < rules.length; index += 1) {
    const previous = rules[index - 1];
    const current = rules[index];

    if (previous.maxScore === null || current.minScore === null) {
      errors.push('Les plages de score se chevauchent.');
      continue;
    }

    if (current.minScore <= previous.maxScore) {
      errors.push(
        `Les plages ${formatMoneyAvailabilityRuleRange(
          previous
        )} et ${formatMoneyAvailabilityRuleRange(current)} se chevauchent.`
      );
    } else if (current.minScore !== previous.maxScore + 1) {
      errors.push(
        `Aucune règle ne couvre les scores entre ${previous.maxScore} et ${current.minScore}.`
      );
    }
  }

  return errors;
}

export function normalizeMoneyAvailabilityRules(
  rawRules: Array<Partial<MoneyAvailabilityRule>> | null | undefined
): MoneyAvailabilityRule[] {
  if (validateMoneyAvailabilityRules(rawRules).length > 0) {
    return cloneMoneyAvailabilityRules(DEFAULT_MONEY_AVAILABILITY_RULES);
  }

  return (rawRules || [])
    .map(normalizedRule)
    .filter((rule): rule is MoneyAvailabilityRule => !!rule)
    .sort((a, b) => ruleSortValue(a) - ruleSortValue(b));
}

export function normalizeMoneyAvailabilityPolicy(
  rawPolicy: Partial<MoneyAvailabilityPolicy> | null | undefined
): MoneyAvailabilityPolicy {
  const hasValidRules =
    validateMoneyAvailabilityRules(rawPolicy?.rules).length === 0;
  const version = Number(rawPolicy?.version);

  if (!hasValidRules) {
    return {
      ...DEFAULT_MONEY_AVAILABILITY_POLICY,
      rules: cloneMoneyAvailabilityRules(DEFAULT_MONEY_AVAILABILITY_RULES),
    };
  }

  return {
    version:
      Number.isInteger(version) && version > 0
        ? version
        : DEFAULT_MONEY_AVAILABILITY_POLICY.version,
    rules: normalizeMoneyAvailabilityRules(rawPolicy!.rules),
    updatedAtMs: Number.isFinite(Number(rawPolicy?.updatedAtMs))
      ? Number(rawPolicy?.updatedAtMs)
      : undefined,
    updatedByUid: rawPolicy?.updatedByUid || undefined,
    updatedByName: rawPolicy?.updatedByName || undefined,
  };
}

export function formatMoneyAvailabilityRuleRange(
  rule: Pick<MoneyAvailabilityRule, 'minScore' | 'maxScore'>
): string {
  if (rule.minScore === null && rule.maxScore === null) {
    return 'Tous les scores';
  }
  if (rule.minScore === null && rule.maxScore !== null) {
    return `Moins de ${rule.maxScore + 1}`;
  }
  if (rule.minScore !== null && rule.maxScore === null) {
    return `${rule.minScore}+`;
  }
  if (rule.minScore === rule.maxScore) {
    return `${rule.minScore}`;
  }
  return `${rule.minScore}–${rule.maxScore}`;
}

export function formatOpenDaysLabel(openDays: number): string {
  if (openDays === 0) {
    return 'Même jour';
  }
  if (openDays === 1) {
    return '1 jour ouvrable';
  }
  return `${openDays} jours ouvrables`;
}

export function findMoneyAvailabilityRule(
  rawScore: number,
  policy: Partial<MoneyAvailabilityPolicy> | null | undefined =
    DEFAULT_MONEY_AVAILABILITY_POLICY
): MoneyAvailabilityRule {
  const normalizedPolicy = normalizeMoneyAvailabilityPolicy(policy);
  const score = Number.isFinite(rawScore) ? rawScore : 50;
  return (
    normalizedPolicy.rules.find(
      (rule) =>
        (rule.minScore === null || score >= rule.minScore) &&
        (rule.maxScore === null || score <= rule.maxScore)
    ) || normalizedPolicy.rules[0]
  );
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
  requestDate: Date = new Date(),
  rawPolicy: Partial<MoneyAvailabilityPolicy> | null | undefined =
    DEFAULT_MONEY_AVAILABILITY_POLICY
): MoneyAvailability {
  const score = Number.isFinite(rawScore) ? rawScore : 50;
  const policy = normalizeMoneyAvailabilityPolicy(rawPolicy);
  const rule = findMoneyAvailabilityRule(score, policy);
  let tier: MoneyAvailabilityTier;
  let bestClientLevel: BestClientLevel = null;

  if (score >= 70) {
    tier = 'best';
    bestClientLevel = score >= 100 ? 'Gold' : 'Silver';
  } else if (score >= 50) {
    tier = 'standard';
  } else {
    tier = 'building';
  }

  const earliestDate = addOpenDays(requestDate, rule.openDays);

  return {
    score,
    tier,
    bestClientLevel,
    earliestDate,
    earliestDateIso: toLocalDateInputValue(earliestDate),
    openDays: rule.openDays,
    ruleId: rule.id,
    policyVersion: policy.version,
  };
}

export function createMoneyAvailabilityPolicySnapshot(
  availability: MoneyAvailability,
  resolvedPolicy: ResolvedMoneyAvailabilityPolicy,
  calculatedAtMs: number = Date.now()
): MoneyAvailabilityPolicySnapshot {
  const rule = findMoneyAvailabilityRule(
    availability.score,
    resolvedPolicy.policy
  );

  return {
    version: resolvedPolicy.policy.version,
    source: resolvedPolicy.source,
    locationId: resolvedPolicy.locationId,
    ruleId: rule.id,
    minScore: rule.minScore,
    maxScore: rule.maxScore,
    openDays: rule.openDays,
    calculatedAtMs,
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
