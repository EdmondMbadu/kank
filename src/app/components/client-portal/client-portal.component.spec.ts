import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';

import { ClientPortalComponent } from './client-portal.component';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

describe('ClientPortalComponent', () => {
  function createComponent(): ClientPortalComponent {
    return new ClientPortalComponent(
      {
        currentUser: { email: 'admin@example.com', firstName: 'Admin' },
        isAdmninistrator: true,
        isAdmin: true,
      } as AuthService,
      {
        snapshot: {
          paramMap: {
            get: () => '2',
          },
        },
      } as unknown as ActivatedRoute,
      {} as Router,
      {} as TimeService,
      {} as DataService,
      {
        getGradientColor: () => '#16a34a',
      } as unknown as ComputationService,
      {} as AngularFireStorage,
      {} as ChangeDetectorRef
    );
  }

  it('should create', () => {
    const component = createComponent();

    expect(component).toBeTruthy();
  });

  it('should sum generated benefit only across finished cycles', () => {
    const component = createComponent();

    component.client = {
      loanAmount: '500',
      amountPaid: '700',
      debtLeft: '0',
      amountToPay: '700',
    } as any;
    component.clientCycles = [
      {
        loanAmount: '1000',
        amountPaid: '1300',
        debtLeft: '0',
        amountToPay: '1300',
      },
      {
        loanAmount: '2500',
        amountPaid: '3100',
        amountToPay: '3100',
      },
      {
        loanAmount: '4000',
        amountPaid: '1800',
        debtLeft: '2200',
        amountToPay: '4000',
      },
    ] as any;

    (component as any).recalculateClientGeneratedBenefit();

    expect(component.clientGeneratedBenefit).toBe(1100);
    expect(component.finishedClientCyclesCount).toBe(3);
  });

  it('should count archived cycles even when finish flags are stale', () => {
    const component = createComponent();

    component.client = {
      loanAmount: '2500',
      amountPaid: '1900',
      debtLeft: '600',
      amountToPay: '2500',
    } as any;
    component.clientCycles = [
      {
        loanAmount: '2000',
        amountPaid: '2000',
        debtLeft: '500',
        amountToPay: '3000',
      },
      {
        loanAmount: '1500',
        amountPaid: 'abc',
        debtLeft: '0',
        amountToPay: '1700',
      },
      {
        loanAmount: '',
        amountPaid: '1600',
        debtLeft: '0',
      },
    ] as any;

    (component as any).recalculateClientGeneratedBenefit();

    expect(component.clientGeneratedBenefit).toBe(2200);
    expect(component.finishedClientCyclesCount).toBe(2);
  });
});
