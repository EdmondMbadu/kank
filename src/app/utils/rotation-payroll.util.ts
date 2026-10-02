import { Employee } from '../models/employee';

export type RotationPayrollIssue =
  | 'missing-source'
  | 'ambiguous-source'
  | 'cyclic-source';

export interface RotationPayrollResolution {
  employee: Employee | null;
  issue?: RotationPayrollIssue;
}

const text = (value: unknown): string => String(value || '').trim();
const phone = (value: unknown): string => text(value).replace(/\D/g, '');
const name = (employee: Employee): string =>
  [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean).join(' ').trim().replace(/\s+/g, ' ').toLowerCase();

/** Only temporary rotations delegate payroll. Never change ranking membership,
 * merge payment histories, or select a source by an unqualified document UID.
 * Follow the complete source chain so a second rotation keeps the original payee.
 * Legacy matching is restricted to the declared source location and must be unique.
 */
export function resolveRotationPayrollEmployee(
  employee: Employee,
  records: readonly Employee[],
  fallbackOwnerUid = ''
): RotationPayrollResolution {
  if (employee.isRotation !== true) return { employee };
  const owner = (record: Employee) => text(record.tempUser?.uid || fallbackOwnerUid);
  const key = (record: Employee) => `${owner(record)}|${text(record.uid)}`;
  const uniqueRecords = Array.from(new Map(
    records.filter((record) => !!record.uid).map((record) => [key(record), record])
  ).values());
  const visited = new Set<string>();
  let current = employee;

  while (current.isRotation === true) {
    if (visited.has(key(current))) return { employee: null, issue: 'cyclic-source' };
    visited.add(key(current));

    const sourceOwner = text(current.rotationSourceLocationId);
    if (!sourceOwner) return { employee: null, issue: 'missing-source' };
    const candidates = uniqueRecords.filter((record) => owner(record) === sourceOwner);
    const sourceUid = text(current.rotationSourceEmployeeId);
    const canonicalUid = text(current.canonicalEmployeeId);
    let matches: Employee[];

    if (sourceUid) {
      // Explicit links are authoritative. A missing target must not be replaced
      // with another person who happens to have the same name or phone.
      matches = candidates.filter((record) => text(record.uid) === sourceUid);
    } else if (canonicalUid) {
      matches = candidates.filter((record) =>
        text(record.uid) === canonicalUid || text(record.canonicalEmployeeId) === canonicalUid
      );
    } else {
      const paymentCode = text(current.paymentCode);
      const phoneNumber = phone(current.phoneNumber);
      const employeeName = name(current);
      const codeMatches = paymentCode
        ? candidates.filter((record) => text(record.paymentCode) === paymentCode) : [];
      const phoneMatches = phoneNumber
        ? candidates.filter((record) => phone(record.phoneNumber) === phoneNumber) : [];
      matches = codeMatches.length ? codeMatches : phoneMatches.length ? phoneMatches
        : employeeName ? candidates.filter((record) => name(record) === employeeName) : [];
      // Even a unique legacy match is unsafe when another available identifier
      // contradicts it. Do not resolve that conflict by choosing one arbitrarily.
      if (matches.length === 1) {
        const candidate = matches[0];
        if ((paymentCode && text(candidate.paymentCode) && paymentCode !== text(candidate.paymentCode)) ||
            (phoneNumber && phone(candidate.phoneNumber) && phoneNumber !== phone(candidate.phoneNumber))) {
          return { employee: null, issue: 'ambiguous-source' };
        }
      }
    }

    if (!matches.length) return { employee: null, issue: 'missing-source' };
    if (matches.length !== 1) return { employee: null, issue: 'ambiguous-source' };
    current = matches[0];
  }

  return { employee: current };
}
