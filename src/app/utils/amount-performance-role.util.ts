const AMOUNT_PERFORMANCE_ROLES = new Set([
  'manager',
  'agent marketing',
  'stagaire',
  // Accept the correctly spelled form if legacy data contains it.
  'stagiaire',
]);

export function isAmountPerformanceRoleEligible(
  role: string | null | undefined
): boolean {
  return AMOUNT_PERFORMANCE_ROLES.has(
    String(role || '').trim().toLowerCase()
  );
}
