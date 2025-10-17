export function coerceToNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const valueAsString = value
    .toString()
    .trim()
    .replace(/,/g, '')
    .replace(/\u00A0/g, ''); // remove non-breaking spaces

  if (!valueAsString) {
    return null;
  }

  const normalized = valueAsString.replace(/[^0-9.-]+/g, '');

  if (
    !normalized ||
    normalized === '-' ||
    normalized === '.' ||
    normalized === '-.'
  ) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
