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
});
