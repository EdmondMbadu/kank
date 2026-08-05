import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { catchError, distinctUntilChanged, map, Observable, of, shareReplay } from 'rxjs';

export type PerformanceMetricMode = 'legacy' | 'amount';

export interface PerformanceMetricSettingsDocument {
  employeeMode?: PerformanceMetricMode;
  updatedAtMs?: number;
  updatedByUid?: string;
}

export function normalizePerformanceMetricMode(
  value: unknown
): PerformanceMetricMode {
  return value === 'amount' ? 'amount' : 'legacy';
}

@Injectable({ providedIn: 'root' })
export class PerformanceMetricSettingsService {
  private readonly settingsPath = 'performanceMetricSettings/default';

  readonly employeeMode$: Observable<PerformanceMetricMode> = this.afs
    .doc<PerformanceMetricSettingsDocument>(this.settingsPath)
    .valueChanges()
    .pipe(
      map((settings) =>
        normalizePerformanceMetricMode(settings?.employeeMode)
      ),
      distinctUntilChanged(),
      catchError((error) => {
        console.error('Failed to load employee performance mode:', error);
        return of<PerformanceMetricMode>('legacy');
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(private afs: AngularFirestore) {}

  updateEmployeeMode(
    employeeMode: PerformanceMetricMode,
    updatedByUid?: string
  ): Promise<void> {
    const normalizedMode = normalizePerformanceMetricMode(employeeMode);
    return this.afs.doc(this.settingsPath).set(
      {
        employeeMode: normalizedMode,
        updatedAtMs: Date.now(),
        updatedByUid: updatedByUid || '',
      },
      { merge: true }
    );
  }
}
