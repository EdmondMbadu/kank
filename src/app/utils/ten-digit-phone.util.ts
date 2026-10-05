export function isTenDigitPhone(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.length === 10 && /^[0-9]{10}$/.test(value);
}

export function tenDigitPhoneValidationMessage(
  value: string | null | undefined,
  interacted: boolean
): string {
  if ((!interacted && !value) || isTenDigitPhone(value)) return '';
  if (!value) return 'Le téléphone est obligatoire. Entrez exactement 10 chiffres.';
  if (/[^0-9]/.test(value)) {
    return 'Entrez uniquement des chiffres, sans espaces ni indicatif : exactement 10 chiffres.';
  }
  const missing = 10 - value.length;
  if (missing > 0) {
    return `Il manque ${missing} chiffre${missing > 1 ? 's' : ''}. Entrez exactement 10 chiffres.`;
  }
  const extra = -missing;
  return `Il y a ${extra} chiffre${extra > 1 ? 's' : ''} en trop. Entrez exactement 10 chiffres.`;
}
