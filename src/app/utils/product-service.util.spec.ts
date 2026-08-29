import {
  OTHER_PRODUCT_SERVICE_OPTION,
  PRODUCT_SERVICE_OPTIONS,
  productServiceSelectionFromStoredValue,
  productServiceStoredValue,
} from './product-service.util';

describe('product and service selection', () => {
  it('keeps the standardized options stable and distinct', () => {
    expect(PRODUCT_SERVICE_OPTIONS.length).toBe(12);
    expect(new Set(PRODUCT_SERVICE_OPTIONS).size).toBe(12);
    expect(PRODUCT_SERVICE_OPTIONS).toContain('Alimentation et boissons');
    expect(PRODUCT_SERVICE_OPTIONS).not.toContain('Autres services' as any);
    expect(PRODUCT_SERVICE_OPTIONS).not.toContain(
      OTHER_PRODUCT_SERVICE_OPTION as any
    );
  });

  it('stores a standard selection without changing its wording', () => {
    expect(
      productServiceStoredValue('Vêtements et chaussures', 'ignored')
    ).toBe('Vêtements et chaussures');
  });

  it('requires a description for the other option', () => {
    expect(productServiceStoredValue(OTHER_PRODUCT_SERVICE_OPTION, '  ')).toBe(
      ''
    );
    expect(
      productServiceStoredValue(
        OTHER_PRODUCT_SERVICE_OPTION,
        '  Vente de charbon  '
      )
    ).toBe('Vente de charbon');
  });

  it('preserves an existing custom value for the other input', () => {
    expect(productServiceSelectionFromStoredValue('  Vendeuse  ')).toEqual({
      selection: OTHER_PRODUCT_SERVICE_OPTION,
      customValue: 'Vendeuse',
    });
  });

  it('requires details when an old vague other-services value is loaded', () => {
    expect(productServiceSelectionFromStoredValue('Autres services')).toEqual({
      selection: OTHER_PRODUCT_SERVICE_OPTION,
      customValue: '',
    });
  });

  it('recognizes an existing standard value without case sensitivity', () => {
    expect(
      productServiceSelectionFromStoredValue('restauration')
    ).toEqual({
      selection: 'Restauration',
      customValue: '',
    });
  });
});
