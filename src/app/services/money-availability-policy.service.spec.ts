import { firstValueFrom, BehaviorSubject, of } from 'rxjs';
import { MoneyAvailabilityPolicyService } from './money-availability-policy.service';

describe('MoneyAvailabilityPolicyService', () => {
  const globalPolicy = {
    version: 3,
    rules: [
      { id: 'low', minScore: null, maxScore: 49, openDays: 6 },
      { id: 'standard', minScore: 50, maxScore: 69, openDays: 3 },
      { id: 'best', minScore: 70, maxScore: null, openDays: 1 },
    ],
  };
  const locationPolicy = {
    locationId: 'site-a',
    enabled: true,
    version: 5,
    rules: [
      { id: 'low', minScore: null, maxScore: 49, openDays: 5 },
      { id: 'standard', minScore: 50, maxScore: 69, openDays: 2 },
      { id: 'best', minScore: 70, maxScore: null, openDays: 1 },
    ],
  };

  function createService(
    globalValue: any,
    locationValue: any
  ): MoneyAvailabilityPolicyService {
    const globalSubject = new BehaviorSubject(globalValue);
    const locationSubject = new BehaviorSubject(locationValue);
    const overridesSubject = new BehaviorSubject(
      locationValue ? [locationValue] : []
    );
    const afs = {
      doc: (path: string) => ({
        valueChanges: () =>
          path === 'moneyAvailabilityPolicies/global'
            ? globalSubject.asObservable()
            : locationSubject.asObservable(),
      }),
      collection: () => ({
        valueChanges: () => overridesSubject.asObservable(),
      }),
    };

    return new MoneyAvailabilityPolicyService(afs as any);
  }

  it('uses an enabled location override before the global policy', async () => {
    const service = createService(globalPolicy, locationPolicy);
    const resolved = await firstValueFrom(service.resolvedPolicy$('site-a'));

    expect(resolved.source).toBe('location');
    expect(resolved.policy.version).toBe(5);
    expect(resolved.policy.rules[1].openDays).toBe(2);
  });

  it('uses the global policy when the location override is disabled', async () => {
    const service = createService(globalPolicy, {
      ...locationPolicy,
      enabled: false,
    });
    const resolved = await firstValueFrom(service.resolvedPolicy$('site-a'));

    expect(resolved.source).toBe('global');
    expect(resolved.policy.version).toBe(3);
    expect(resolved.policy.rules[1].openDays).toBe(3);
  });

  it('ignores an enabled location override when its score ranges are invalid', async () => {
    const service = createService(globalPolicy, {
      ...locationPolicy,
      rules: [
        { id: 'low', minScore: null, maxScore: 60, openDays: 5 },
        { id: 'overlap', minScore: 50, maxScore: null, openDays: 2 },
      ],
    });
    const resolved = await firstValueFrom(service.resolvedPolicy$('site-a'));

    expect(resolved.source).toBe('global');
    expect(resolved.policy.version).toBe(3);
  });

  it('uses the safe fallback when no valid stored global policy exists', async () => {
    const service = createService(undefined, undefined);
    const resolved = await firstValueFrom(service.resolvedPolicy$('site-a'));

    expect(resolved.source).toBe('fallback');
    expect(resolved.policy.rules.map((rule) => rule.openDays)).toEqual([
      6, 3, 3, 1,
    ]);
  });

  it('apply-to-all disables active overrides but preserves disabled override documents', async () => {
    const globalRef = {
      get: jasmine.createSpy('getGlobal').and.resolveTo({
        exists: true,
        data: () => globalPolicy,
      }),
    };
    const activeRef = { id: 'active-ref' };
    const inactiveRef = { id: 'inactive-ref' };
    const historyRef = { id: 'history-ref' };
    const setSpy = jasmine.createSpy('batchSet');
    const commitSpy = jasmine
      .createSpy('batchCommit')
      .and.returnValue(Promise.resolve());
    const overrideDocs = [
      {
        id: 'site-a',
        ref: activeRef,
        data: () => ({ ...locationPolicy, enabled: true }),
      },
      {
        id: 'site-b',
        ref: inactiveRef,
        data: () => ({ ...locationPolicy, enabled: false }),
      },
    ];
    const afs = {
      doc: (path: string) => ({
        valueChanges: () => of(path === 'moneyAvailabilityPolicies/global' ? globalPolicy : null),
        ref: globalRef,
      }),
      collection: (path: string) => {
        if (path === 'moneyAvailabilityPolicies/global/locationOverrides') {
          return {
            valueChanges: () => of([]),
            ref: {
              get: () => Promise.resolve({ docs: overrideDocs }),
            },
          };
        }
        return {
          valueChanges: () => of([]),
          doc: () => ({ ref: historyRef }),
        };
      },
      firestore: {
        batch: () => ({
          set: setSpy,
          commit: commitSpy,
        }),
      },
    };
    const service = new MoneyAvailabilityPolicyService(afs as any);

    const result = await service.saveGlobalRules(
      globalPolicy.rules,
      { uid: 'admin-1', name: 'Admin' },
      true
    );

    expect(result.disabledLocationIds).toEqual(['site-a']);
    expect(setSpy).toHaveBeenCalledWith(
      activeRef,
      jasmine.objectContaining({ enabled: false }),
      { merge: true }
    );
    expect(
      setSpy.calls.allArgs().some((args) => args[0] === inactiveRef)
    ).toBeFalse();
    expect(commitSpy).toHaveBeenCalled();
  });
});
