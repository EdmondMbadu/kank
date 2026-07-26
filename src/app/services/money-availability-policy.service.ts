import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { combineLatest, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import {
  cloneMoneyAvailabilityRules,
  DEFAULT_MONEY_AVAILABILITY_POLICY,
  MoneyAvailabilityPolicy,
  MoneyAvailabilityRule,
  normalizeMoneyAvailabilityPolicy,
  ResolvedMoneyAvailabilityPolicy,
  validateMoneyAvailabilityRules,
} from '../utils/money-availability.util';

export interface MoneyAvailabilityPolicyActor {
  uid: string;
  name: string;
}

export interface MoneyAvailabilityLocationOverride
  extends MoneyAvailabilityPolicy {
  locationId: string;
  enabled: boolean;
  isValid?: boolean;
  disabledAtMs?: number;
  disabledByUid?: string;
  disabledByName?: string;
}

export interface MoneyAvailabilityGlobalSaveResult {
  version: number;
  disabledLocationIds: string[];
}

type GlobalPolicyState = {
  policy: MoneyAvailabilityPolicy;
  isStoredPolicyValid: boolean;
};

const GLOBAL_POLICY_PATH = 'moneyAvailabilityPolicies/global';
const LOCATION_OVERRIDES_PATH =
  'moneyAvailabilityPolicies/global/locationOverrides';
const GLOBAL_HISTORY_PATH = 'moneyAvailabilityPolicies/global/history';

@Injectable({
  providedIn: 'root',
})
export class MoneyAvailabilityPolicyService {
  private readonly globalState$: Observable<GlobalPolicyState> = this.afs
    .doc<MoneyAvailabilityPolicy>(GLOBAL_POLICY_PATH)
    .valueChanges()
    .pipe(
      map((value) => ({
        policy: normalizeMoneyAvailabilityPolicy(value),
        isStoredPolicyValid:
          !!value && validateMoneyAvailabilityRules(value.rules).length === 0,
      })),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  readonly globalPolicy$: Observable<MoneyAvailabilityPolicy> =
    this.globalState$.pipe(map((state) => state.policy));

  readonly locationOverrides$: Observable<
    MoneyAvailabilityLocationOverride[]
  > = this.afs
    .collection<MoneyAvailabilityLocationOverride>(LOCATION_OVERRIDES_PATH)
    .valueChanges({ idField: 'locationId' })
    .pipe(
      map((values) =>
        (values || []).map((value) => this.normalizeLocationOverride(value))
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(private afs: AngularFirestore) {}

  locationOverride$(
    locationId: string
  ): Observable<MoneyAvailabilityLocationOverride | null> {
    if (!locationId) {
      return new Observable((subscriber) => {
        subscriber.next(null);
        subscriber.complete();
      });
    }

    return this.afs
      .doc<MoneyAvailabilityLocationOverride>(
        `${LOCATION_OVERRIDES_PATH}/${locationId}`
      )
      .valueChanges()
      .pipe(
        map((value) =>
          value
            ? this.normalizeLocationOverride({
                ...value,
                locationId,
              })
            : null
        ),
        shareReplay({ bufferSize: 1, refCount: true })
      );
  }

  resolvedPolicy$(
    locationId: string
  ): Observable<ResolvedMoneyAvailabilityPolicy> {
    return combineLatest([
      this.globalState$,
      this.locationOverride$(locationId),
    ]).pipe(
      map(([globalState, locationOverride]) => {
        if (
          locationOverride?.enabled &&
          locationOverride.isValid !== false &&
          validateMoneyAvailabilityRules(locationOverride.rules).length === 0
        ) {
          return {
            policy: normalizeMoneyAvailabilityPolicy(locationOverride),
            source: 'location' as const,
            locationId,
          };
        }

        return {
          policy: globalState.policy,
          source: globalState.isStoredPolicyValid
            ? ('global' as const)
            : ('fallback' as const),
          locationId,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  async saveGlobalRules(
    rules: MoneyAvailabilityRule[],
    actor: MoneyAvailabilityPolicyActor,
    applyToAllLocations: boolean
  ): Promise<MoneyAvailabilityGlobalSaveResult> {
    this.assertValidRules(rules);

    const now = Date.now();
    const globalRef = this.afs.doc<MoneyAvailabilityPolicy>(
      GLOBAL_POLICY_PATH
    ).ref;
    const currentSnapshot = await globalRef.get();
    const currentPolicy = normalizeMoneyAvailabilityPolicy(
      currentSnapshot.data()
    );
    const version = currentSnapshot.exists ? currentPolicy.version + 1 : 1;
    const normalizedRules = cloneMoneyAvailabilityRules(rules);
    const overrideSnapshot = applyToAllLocations
      ? await this.afs
          .collection<MoneyAvailabilityLocationOverride>(
            LOCATION_OVERRIDES_PATH
          )
          .ref.get()
      : null;
    const activeOverrideDocs = (overrideSnapshot?.docs || []).filter(
      (doc) => doc.data()?.enabled === true
    );

    // A Firestore batch supports 500 operations. The policy write, history
    // write, and active overrides must all fit so "apply to all" is atomic.
    if (activeOverrideDocs.length > 498) {
      throw new Error(
        "Trop de dérogations actives pour appliquer cette règle en une seule opération."
      );
    }

    const batch = this.afs.firestore.batch();
    const policyPayload: MoneyAvailabilityPolicy = {
      version,
      rules: normalizedRules,
      updatedAtMs: now,
      updatedByUid: actor.uid || '',
      updatedByName: actor.name || '',
    };
    const disabledLocationIds = activeOverrideDocs.map((doc) => doc.id);

    batch.set(globalRef, policyPayload, { merge: true });
    const historyRef = this.afs.collection(GLOBAL_HISTORY_PATH).doc().ref;
    batch.set(historyRef, {
      ...policyPayload,
      action: applyToAllLocations
        ? 'global-update-apply-to-all'
        : 'global-update',
      disabledLocationIds,
    });

    activeOverrideDocs.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          enabled: false,
          disabledAtMs: now,
          disabledByUid: actor.uid || '',
          disabledByName: actor.name || '',
        },
        { merge: true }
      );
    });

    await batch.commit();
    return { version, disabledLocationIds };
  }

  async saveLocationOverride(
    locationId: string,
    rules: MoneyAvailabilityRule[],
    actor: MoneyAvailabilityPolicyActor
  ): Promise<void> {
    if (!locationId) {
      throw new Error('Aucune localisation sélectionnée.');
    }
    this.assertValidRules(rules);

    const docRef = this.afs.doc<MoneyAvailabilityLocationOverride>(
      `${LOCATION_OVERRIDES_PATH}/${locationId}`
    ).ref;
    const snapshot = await docRef.get();
    const currentVersion = snapshot.exists
      ? normalizeMoneyAvailabilityPolicy(snapshot.data()).version
      : 0;
    const now = Date.now();
    const payload: MoneyAvailabilityLocationOverride = {
      locationId,
      enabled: true,
      version: currentVersion + 1,
      rules: cloneMoneyAvailabilityRules(rules),
      updatedAtMs: now,
      updatedByUid: actor.uid || '',
      updatedByName: actor.name || '',
    };
    const historyRef = this.afs
      .collection(`${LOCATION_OVERRIDES_PATH}/${locationId}/history`)
      .doc().ref;
    const batch = this.afs.firestore.batch();

    batch.set(docRef, payload, { merge: true });
    batch.set(historyRef, {
      ...payload,
      action: snapshot.exists
        ? 'location-override-update'
        : 'location-override-create',
    });
    await batch.commit();
  }

  async disableLocationOverride(
    locationId: string,
    actor: MoneyAvailabilityPolicyActor
  ): Promise<void> {
    if (!locationId) {
      throw new Error('Aucune localisation sélectionnée.');
    }

    const docRef = this.afs.doc<MoneyAvailabilityLocationOverride>(
      `${LOCATION_OVERRIDES_PATH}/${locationId}`
    ).ref;
    const snapshot = await docRef.get();
    if (!snapshot.exists || snapshot.data()?.enabled !== true) {
      return;
    }

    const now = Date.now();
    const batch = this.afs.firestore.batch();
    batch.set(
      docRef,
      {
        enabled: false,
        disabledAtMs: now,
        disabledByUid: actor.uid || '',
        disabledByName: actor.name || '',
      },
      { merge: true }
    );
    const historyRef = this.afs
      .collection(`${LOCATION_OVERRIDES_PATH}/${locationId}/history`)
      .doc().ref;
    batch.set(historyRef, {
      ...snapshot.data(),
      locationId,
      enabled: false,
      disabledAtMs: now,
      disabledByUid: actor.uid || '',
      disabledByName: actor.name || '',
      action: 'location-override-disabled',
    });
    await batch.commit();
  }

  private assertValidRules(rules: MoneyAvailabilityRule[]): void {
    const errors = validateMoneyAvailabilityRules(rules);
    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }

  private normalizeLocationOverride(
    value: Partial<MoneyAvailabilityLocationOverride>
  ): MoneyAvailabilityLocationOverride {
    const isValid = validateMoneyAvailabilityRules(value.rules).length === 0;
    const policy = normalizeMoneyAvailabilityPolicy(value);
    return {
      ...policy,
      locationId: value.locationId || '',
      enabled: value.enabled === true,
      isValid,
      disabledAtMs: Number.isFinite(Number(value.disabledAtMs))
        ? Number(value.disabledAtMs)
        : undefined,
      disabledByUid: value.disabledByUid || undefined,
      disabledByName: value.disabledByName || undefined,
    };
  }
}
