import { firstValueFrom, of, throwError } from 'rxjs';

import {
  normalizePerformanceMetricMode,
  PerformanceMetricSettingsService,
} from './performance-metric-settings.service';

describe('PerformanceMetricSettingsService', () => {
  it('defaults every missing or invalid persisted value to the legacy mode', () => {
    expect(normalizePerformanceMetricMode(undefined)).toBe('legacy');
    expect(normalizePerformanceMetricMode(null)).toBe('legacy');
    expect(normalizePerformanceMetricMode('unexpected')).toBe('legacy');
    expect(normalizePerformanceMetricMode('amount')).toBe('amount');
  });

  it('publishes the normalized stored employee mode', async () => {
    const afs = {
      doc: () => ({
        valueChanges: () => of({ employeeMode: 'amount' }),
        set: jasmine.createSpy('set').and.resolveTo(),
      }),
    } as any;
    const service = new PerformanceMetricSettingsService(afs);

    expect(await firstValueFrom(service.employeeMode$)).toBe('amount');
  });

  it('falls back safely when the settings document cannot be read', async () => {
    spyOn(console, 'error');
    const afs = {
      doc: () => ({
        valueChanges: () =>
          throwError(() => new Error('settings unavailable')),
        set: jasmine.createSpy('set').and.resolveTo(),
      }),
    } as any;
    const service = new PerformanceMetricSettingsService(afs);

    expect(await firstValueFrom(service.employeeMode$)).toBe('legacy');
  });

  it('writes only a normalized mode and audit metadata', async () => {
    const set = jasmine.createSpy('set').and.resolveTo();
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue({
        valueChanges: () => of(undefined),
        set,
      }),
    } as any;
    const service = new PerformanceMetricSettingsService(afs);

    await service.updateEmployeeMode('amount', 'admin-1');

    expect(afs.doc).toHaveBeenCalledWith('performanceMetricSettings/default');
    expect(set).toHaveBeenCalledWith(
      jasmine.objectContaining({
        employeeMode: 'amount',
        updatedByUid: 'admin-1',
        updatedAtMs: jasmine.any(Number),
      }),
      { merge: true }
    );
  });
});
