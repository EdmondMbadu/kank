import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

export const DEFAULT_CARD_SMS_MINIMUM_FC = 400000;

export interface CardSmsSettings {
  enabled: boolean;
  minimumAmountToPayFc: number;
  updatedAtMs: number;
  updatedByUid: string;
  updatedByName: string;
  version: number;
}

export function normalizeCardSmsSettings(
  value: Partial<CardSmsSettings> | null | undefined
): CardSmsSettings {
  const minimum = Number(value?.minimumAmountToPayFc);

  return {
    enabled: value?.enabled === true,
    minimumAmountToPayFc:
      Number.isInteger(minimum) && minimum > 0
        ? minimum
        : DEFAULT_CARD_SMS_MINIMUM_FC,
    updatedAtMs: Number(value?.updatedAtMs) || 0,
    updatedByUid: String(value?.updatedByUid || ''),
    updatedByName: String(value?.updatedByName || ''),
    version: Math.max(0, Math.floor(Number(value?.version) || 0)),
  };
}

@Injectable({ providedIn: 'root' })
export class CardSmsSettingsService {
  private readonly settingsPath = 'card_sms_settings/default';

  readonly settings$: Observable<CardSmsSettings> = this.afs
    .doc<Partial<CardSmsSettings>>(this.settingsPath)
    .valueChanges()
    .pipe(
      map((value) => normalizeCardSmsSettings(value)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(private afs: AngularFirestore) {}

  async save(
    enabled: boolean,
    minimumAmountToPayFc: number,
    actor: { uid: string; name: string }
  ): Promise<void> {
    if (
      !Number.isInteger(minimumAmountToPayFc) ||
      minimumAmountToPayFc <= 0
    ) {
      throw new Error('Le seuil doit être un nombre entier supérieur à zéro.');
    }

    const ref = this.afs.doc<CardSmsSettings>(this.settingsPath).ref;
    const snapshot = await ref.get();
    const current = normalizeCardSmsSettings(snapshot.data());

    await ref.set(
      {
        enabled,
        minimumAmountToPayFc,
        updatedAtMs: Date.now(),
        updatedByUid: actor.uid || '',
        updatedByName: actor.name || '',
        version: current.version + 1,
      },
      { merge: true }
    );
  }
}
