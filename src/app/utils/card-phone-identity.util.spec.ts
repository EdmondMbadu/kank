import {
  assertCardPhoneIdentity, CardPhoneValidationError,
  normalizeStoredCardPhone, sharesCardName,
} from './card-phone-identity.util';

describe('Card phone identity', () => {
  const client = { firstName: 'Edmond', middleName: 'Mbadu', lastName: 'Ngoma', phoneNumber: '0812345678' };

  it('allows an unused ten-digit phone', () => {
    expect(() => assertCardPhoneIdentity(client, [], [])).not.toThrow();
  });

  it('allows the supplied typo and card-number example with one shared name', () => {
    expect(() => assertCardPhoneIdentity({ ...client, firstName: 'Emdond', lastName: 'Mbadu 2' }, [client], [])).not.toThrow();
  });

  it('matches across fields, capitalization, accents and whitespace', () => {
    expect(sharesCardName({ firstName: '  José  ' }, { lastName: 'JOSE' })).toBeTrue();
    expect(sharesCardName({ firstName: 'Edmond', lastName: 'Mbadu' }, { middleName: ' mbadu  2 ' })).toBeTrue();
  });

  it('does not match substrings, typos, empty names or numeric card labels', () => {
    expect(sharesCardName({ firstName: 'Ed' }, { firstName: 'Edmond' })).toBeFalse();
    expect(sharesCardName({ firstName: 'Emdond' }, { firstName: 'Edmond' })).toBeFalse();
    expect(sharesCardName({}, {})).toBeFalse();
    expect(sharesCardName({ lastName: 'Mbadu 2' }, { lastName: 'Ngoma 2' })).toBeFalse();
  });

  it('identifies the conflicting client and tells staff what to fix', () => {
    expect(() => assertCardPhoneIdentity({ ...client, firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo' }, [client], []))
      .toThrowError(CardPhoneValidationError, 'Ce numéro est déjà utilisé par Edmond Mbadu Ngoma. Aucun nom ne correspond. Vérifiez les noms ou entrez le bon numéro du client.');
  });

  it('checks every duplicate, even if another card shares a name', () => {
    expect(() => assertCardPhoneIdentity(client, [client, { firstName: 'Sarah', phoneNumber: client.phoneNumber }], []))
      .toThrowError(CardPhoneValidationError, /Sarah/);
  });

  it('ignores names on cards with a different phone', () => {
    expect(() => assertCardPhoneIdentity(client, [{ firstName: 'Sarah', phoneNumber: '0893258653' }], [])).not.toThrow();
  });

  it('blocks an employee phone even when the name matches a client card', () => {
    expect(() => assertCardPhoneIdentity(client, [client], [{ ...client, phoneNumber: '+243 812 345 678' }]))
      .toThrowError(CardPhoneValidationError, 'Ce numéro appartient à un employé. Entrez le numéro du client.');
  });

  it('gives a repair instruction for a legacy card missing names', () => {
    expect(() => assertCardPhoneIdentity(client, [{ phoneNumber: client.phoneNumber }], []))
      .toThrowError(CardPhoneValidationError, /Faites corriger cette carte/);
  });

  ['', '081234567', '08123456789', '081234567a', '0812345678\n', '+243812345678'].forEach((phoneNumber) => {
    it(`rejects new input ${JSON.stringify(phoneNumber)} even if a stored number can be normalized`, () => {
      expect(() => assertCardPhoneIdentity({ ...client, phoneNumber }, [], []))
        .toThrowError(CardPhoneValidationError, /10 chiffres/);
    });
  });

  ['0812345678', '081 234 5678', '+243812345678', '243812345678', '00243812345678', '812345678', '+243 (0)812-345-678'].forEach((stored) => {
    it(`recognizes the stored format ${stored}`, () => {
      expect(normalizeStoredCardPhone(stored)).toBe(client.phoneNumber);
    });
  });

  it('does not mistake invalid numbers or foreign country codes for the same phone', () => {
    ['', 'abc0812345678', '+33123456789', '08123456789'].forEach((value) => {
      expect(normalizeStoredCardPhone(value)).toBe('');
    });
  });
});
