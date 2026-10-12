import { isTenDigitPhone, tenDigitPhoneValidationMessage } from './ten-digit-phone.util';

export interface CardPhoneIdentity {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export type CardPhoneRejection = 'invalid-phone' | 'employee-phone' | 'name-conflict' | 'lookup-failed';

export class CardPhoneValidationError extends Error {
  constructor(public readonly reason: CardPhoneRejection, message: string) {
    super(message);
    this.name = 'CardPhoneValidationError';
  }
}

// Stored employee/card numbers predate the ten-digit input requirement.
// Compare common DRC local and international formats without changing input rules.
export function normalizeStoredCardPhone(value: unknown): string {
  const compact = String(value ?? '').trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return '';
  let digits = compact.replace(/^\+/, '').replace(/^00243/, '243');
  if (digits.startsWith('243') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(3);
  }
  if (digits.length === 9) digits = `0${digits}`;
  return isTenDigitPhone(digits) ? digits : '';
}

export function cardNameTokens(identity: CardPhoneIdentity): string[] {
  return [identity.firstName, identity.middleName, identity.lastName]
    .flatMap((value) => String(value ?? '').normalize('NFD')
      .replace(/\p{M}/gu, '').trim().toLowerCase().split(/\s+/))
    // Empty fields and card labels such as "2" cannot establish a name match.
    .filter((token) => /\p{L}/u.test(token));
}

export function sharesCardName(a: CardPhoneIdentity, b: CardPhoneIdentity): boolean {
  const names = new Set(cardNameTokens(a));
  return cardNameTokens(b).some((name) => names.has(name));
}

export function assertCardPhoneIdentity(
  candidate: CardPhoneIdentity,
  cards: CardPhoneIdentity[],
  employees: CardPhoneIdentity[]
): void {
  if (!isTenDigitPhone(candidate.phoneNumber)) {
    throw new CardPhoneValidationError('invalid-phone',
      tenDigitPhoneValidationMessage(candidate.phoneNumber, true));
  }
  if (employees.some((employee) => normalizeStoredCardPhone(employee.phoneNumber) === candidate.phoneNumber)) {
    throw new CardPhoneValidationError('employee-phone',
      'Ce numéro appartient à un employé. Entrez le numéro du client.');
  }
  const conflict = cards.find((card) =>
    normalizeStoredCardPhone(card.phoneNumber) === candidate.phoneNumber && !sharesCardName(candidate, card));
  if (conflict) {
    const name = [conflict.firstName, conflict.middleName, conflict.lastName]
      .map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
    throw new CardPhoneValidationError('name-conflict', name
      ? `Ce numéro est déjà utilisé par ${name}. Aucun nom ne correspond. Vérifiez les noms ou entrez le bon numéro du client.`
      : 'Ce numéro est déjà utilisé sur une carte sans nom. Faites corriger cette carte avant de réutiliser le numéro.');
  }
}
