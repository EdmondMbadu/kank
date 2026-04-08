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

  it('should select all previous cycles by default and sum their benefits', () => {
    const component = createComponent();

    component.clientCycles = [
      {
        cycleId: 'cycle-4',
        loanAmount: '1000',
        amountPaid: '1300',
        debtLeft: '0',
        amountToPay: '1300',
      },
      {
        cycleId: 'cycle-5',
        loanAmount: '2500',
        amountPaid: '3100',
        amountToPay: '3100',
      },
    ] as any;

    (component as any).syncSelectedClientCycles(component.clientCycles);
    (component as any).recalculateClientGeneratedBenefit();

    expect(component.selectedClientCycleIds.size).toBe(2);
    expect(component.clientGeneratedBenefit).toBe(900);
    expect(component.finishedClientCyclesCount).toBe(2);
  });

  it('should update the total when a cycle is deselected', () => {
    const component = createComponent();

    component.clientCycles = [
      {
        cycleId: 'cycle-4',
        loanAmount: '2000',
        amountPaid: '2000',
        debtLeft: '500',
        amountToPay: '3000',
      },
      {
        cycleId: 'cycle-5',
        loanAmount: '1500',
        amountPaid: '1800',
        debtLeft: '0',
      },
    ] as any;

    (component as any).syncSelectedClientCycles(component.clientCycles);
    component.toggleClientCycleSelection(component.clientCycles[0] as any);

    expect(component.clientGeneratedBenefit).toBe(300);
    expect(component.finishedClientCyclesCount).toBe(1);
    expect(component.isCycleSelected(component.clientCycles[0] as any)).toBeFalse();
    expect(component.isCycleSelected(component.clientCycles[1] as any)).toBeTrue();
  });

  it('should count archived cycles even when finish flags are stale', () => {
    const component = createComponent();

    component.clientCycles = [
      {
        cycleId: 'cycle-4',
        loanAmount: '2000',
        amountPaid: '2000',
        debtLeft: '500',
        amountToPay: '3000',
      },
      {
        cycleId: 'cycle-5',
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

    (component as any).syncSelectedClientCycles(component.clientCycles);
    (component as any).recalculateClientGeneratedBenefit();

    expect(component.clientGeneratedBenefit).toBe(2200);
    expect(component.finishedClientCyclesCount).toBe(2);
  });
});
