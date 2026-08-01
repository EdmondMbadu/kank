import { Employee, Trophy } from 'src/app/models/employee';

function normalizeText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function normalizePhone(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function normalizedEmployeeName(employee: Employee): string {
  return [employee.firstName, employee.middleName, employee.lastName]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join('|');
}

function isSameEmployee(first: Employee, second: Employee): boolean {
  if (first.uid && second.uid && first.uid === second.uid) return true;

  const firstPaymentCode = normalizeText(first.paymentCode);
  const secondPaymentCode = normalizeText(second.paymentCode);
  if (firstPaymentCode && firstPaymentCode === secondPaymentCode) return true;

  const firstPhone = normalizePhone(first.phoneNumber);
  const secondPhone = normalizePhone(second.phoneNumber);
  if (firstPhone && firstPhone === secondPhone) return true;

  const firstName = normalizedEmployeeName(first);
  const secondName = normalizedEmployeeName(second);
  return !!firstName && firstName === secondName;
}

function isActiveEmployee(employee: Employee): boolean {
  return normalizeText(employee.status) === 'travaille';
}

function mergeTrophies(
  first: Trophy[] | undefined,
  second: Trophy[] | undefined
): Trophy[] {
  const trophies = new Map<string, Trophy>();
  [...(first || []), ...(second || [])].forEach((trophy) => {
    const key = `${trophy?.month || ''}|${trophy?.year || ''}`;
    if (key !== '|' && !trophies.has(key)) trophies.set(key, trophy);
  });
  return Array.from(trophies.values());
}

export function dedupeTrophyHistoryEmployees(
  employees: Employee[]
): Employee[] {
  const deduped: Employee[] = [];

  (employees || []).forEach((employee) => {
    const duplicateIndex = deduped.findIndex((candidate) =>
      isSameEmployee(candidate, employee)
    );
    if (duplicateIndex < 0) {
      deduped.push(employee);
      return;
    }

    const existing = deduped[duplicateIndex];
    const preferred =
      isActiveEmployee(employee) && !isActiveEmployee(existing)
        ? employee
        : existing;
    deduped[duplicateIndex] = {
      ...preferred,
      bestTeamTrophies: mergeTrophies(
        existing.bestTeamTrophies,
        employee.bestTeamTrophies
      ),
      bestEmployeeTrophies: mergeTrophies(
        existing.bestEmployeeTrophies,
        employee.bestEmployeeTrophies
      ),
    };
  });

  return deduped;
}
