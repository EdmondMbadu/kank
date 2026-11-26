import { TestBed } from '@angular/core/testing';

import { TimeService } from './time.service';

describe('TimeService', () => {
  let service: TimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('formats the next payment date fully in French with a capitalized weekday', () => {
    const display = service.nextPaymentDateDisplay(
      new Date(2026, 7, 18),
      new Date(2026, 7, 20)
    );

    expect(display.long).toBe('Mardi 25 août 2026');
    expect(display.numeric).toBe('25/08/2026');
  });

  it('uses the saved payment day even when registration was on a different weekday', () => {
    const display = service.nextPaymentDateDisplay(
      new Date(2026, 10, 19), // Thursday registration
      new Date(2026, 10, 26), // Thursday today
      'Friday'
    );

    expect(display.long).toBe('Vendredi 27 novembre 2026');
    expect(display.numeric).toBe('27/11/2026');
  });

  it('rolls over the month using the payment weekday', () => {
    const display = service.nextPaymentDateDisplay(
      new Date(2026, 10, 19),
      new Date(2026, 10, 28),
      'Friday'
    );

    expect(display.long).toBe('Vendredi 4 décembre 2026');
    expect(display.numeric).toBe('04/12/2026');
  });

  it('keeps the existing next-week rule when today is the payment day', () => {
    const display = service.nextPaymentDateDisplay(
      new Date(2026, 10, 19),
      new Date(2026, 11, 4),
      'Friday'
    );

    expect(display.long).toBe('Vendredi 11 décembre 2026');
    expect(display.numeric).toBe('11/12/2026');
  });

  it('does not need a registration date when a payment day is saved', () => {
    const display = service.nextPaymentDateDisplay(
      undefined,
      new Date(2026, 11, 31),
      'Friday'
    );

    expect(display.long).toBe('Vendredi 1 janvier 2027');
    expect(display.numeric).toBe('01/01/2027');
  });

  it('uses the payment weekday for the compact date shown in related portals', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 10, 28));
      expect(service.nextPaymentDate(new Date(2026, 10, 19), 'Friday')).toBe('Dec 04');
    } finally {
      jasmine.clock().uninstall();
    }
  });

});
