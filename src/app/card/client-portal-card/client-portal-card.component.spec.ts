import { FormBuilder } from '@angular/forms';

import { ClientPortalCardComponent } from './client-portal-card.component';

describe('ClientPortalCardComponent', () => {
  const buildComponent = (isAdmin: boolean) =>
    new ClientPortalCardComponent(
      { isAdmin, currentUser: {} } as any,
      { snapshot: { paramMap: { get: () => '0' } } } as any,
      {} as any,
      {} as any,
      {} as any,
      new FormBuilder(),
      {} as any
    );

  it('allows total-withdraw undo only for admin on terminé cards with a snapshot', () => {
    const component = buildComponent(true);
    component.status = 'Terminé';
    component.clientCard = {
      totalWithdrawalSnapshot: {
        returnedAmount: '5000',
        returnDayKey: '4-5-2026',
      },
    } as any;

    expect(component.canUndoRetraitTotal).toBeTrue();
  });

  it('hides total-withdraw undo when the snapshot is missing', () => {
    const component = buildComponent(true);
    component.status = 'Terminé';
    component.clientCard = {} as any;

    expect(component.canUndoRetraitTotal).toBeFalse();
  });

  it('hides total-withdraw undo for non-admin users', () => {
    const component = buildComponent(false);
    component.status = 'Terminé';
    component.clientCard = {
      totalWithdrawalSnapshot: {
        returnedAmount: '5000',
        returnDayKey: '4-5-2026',
      },
    } as any;

    expect(component.canUndoRetraitTotal).toBeFalse();
  });
});
