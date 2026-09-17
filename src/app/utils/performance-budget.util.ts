export const DEFAULT_PERFORMANCE_BUDGET_PROPORTION = 50;

export function normalizePerformanceBudgetProportion(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      String(value).trim() === '') return DEFAULT_PERFORMANCE_BUDGET_PROPORTION;
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100
    ? percent : DEFAULT_PERFORMANCE_BUDGET_PROPORTION;
}

export function scalePerformanceBudget(baseFc: number, proportion: unknown): number {
  return Math.round(baseFc * normalizePerformanceBudgetProportion(proportion) / 100);
}
