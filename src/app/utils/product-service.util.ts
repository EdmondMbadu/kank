export const PRODUCT_SERVICE_OPTIONS = [
  'Alimentation et boissons',
  'Vêtements et chaussures',
  'Cosmétiques et produits de beauté',
  'Coiffure et soins',
  'Produits ménagers',
  'Téléphones et accessoires',
  'Quincaillerie et construction',
  'Pharmacie et santé',
  'Agriculture et élevage',
  'Restauration',
  'Transport',
  'Réparation et artisanat',
] as const;

export const OTHER_PRODUCT_SERVICE_OPTION = 'Autres produits ou services';

const LEGACY_UNSPECIFIED_OPTIONS = [
  'Autres services',
  'Autre produit ou service',
] as const;

export interface ProductServiceSelection {
  selection: string;
  customValue: string;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('fr-FR');
}

export function productServiceSelectionFromStoredValue(
  storedValue: string | null | undefined
): ProductServiceSelection {
  const value = (storedValue ?? '').trim();
  if (!value) {
    return { selection: '', customValue: '' };
  }

  const standardOption = PRODUCT_SERVICE_OPTIONS.find(
    (option) => normalize(option) === normalize(value)
  );
  if (standardOption) {
    return { selection: standardOption, customValue: '' };
  }

  if (
    normalize(value) === normalize(OTHER_PRODUCT_SERVICE_OPTION) ||
    LEGACY_UNSPECIFIED_OPTIONS.some(
      (option) => normalize(option) === normalize(value)
    )
  ) {
    return { selection: OTHER_PRODUCT_SERVICE_OPTION, customValue: '' };
  }

  return {
    selection: OTHER_PRODUCT_SERVICE_OPTION,
    customValue: value,
  };
}

export function productServiceStoredValue(
  selection: string | null | undefined,
  customValue: string | null | undefined
): string {
  const selectedValue = (selection ?? '').trim();
  if (!selectedValue) return '';

  if (normalize(selectedValue) === normalize(OTHER_PRODUCT_SERVICE_OPTION)) {
    return (customValue ?? '').trim();
  }

  const standardOption = PRODUCT_SERVICE_OPTIONS.find(
    (option) => normalize(option) === normalize(selectedValue)
  );
  return standardOption ?? '';
}
