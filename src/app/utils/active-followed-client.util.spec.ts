import { Client } from '../models/client';
import { isActivelyFollowedClient } from './active-followed-client.util';

describe('active followed client', () => {
  it('includes only active clients with remaining debt', () => {
    expect(
      isActivelyFollowedClient({ debtLeft: '100', vitalStatus: '' } as Client)
    ).toBeTrue();
    expect(
      isActivelyFollowedClient({
        debtLeft: '100',
        vitalStatus: ' Vivant ',
      } as Client)
    ).toBeTrue();
  });

  it('excludes clients who left, are set aside, died, or finished paying', () => {
    for (const vitalStatus of ['Quitté', 'À l’écart', 'Mort']) {
      expect(
        isActivelyFollowedClient({ debtLeft: '100', vitalStatus } as Client)
      ).toBeFalse();
    }
    expect(
      isActivelyFollowedClient({ debtLeft: '0', vitalStatus: 'Vivant' } as Client)
    ).toBeFalse();
    expect(
      isActivelyFollowedClient({ debtLeft: '-1', vitalStatus: 'Vivant' } as Client)
    ).toBeFalse();
    expect(
      isActivelyFollowedClient({ debtLeft: 'inconnu', vitalStatus: 'Vivant' } as Client)
    ).toBeFalse();
  });
});
