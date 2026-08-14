import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import {
  catchError,
  map,
  shareReplay,
  switchMap,
} from 'rxjs/operators';
import {
  FirestoreV2CompactProjectionDocument,
  reconstructCompactLegacyDocument,
} from '../utils/firestore-v2-compat.util';

type MigrationControl = {
  readFromV2?: boolean;
  killSwitch?: boolean;
  readKinds?: string[];
};

@Injectable({ providedIn: 'root' })
export class FirestoreV2CompatService {
  private readonly readControl$: Observable<MigrationControl | null> = this.afs
    .doc<MigrationControl>('migrationControls/firestoreV2')
    .valueChanges()
    .pipe(
      map((control) => control ?? null),
      catchError((error) => {
        console.error('Firestore v2 control read failed; using legacy data.', error);
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(private afs: AngularFirestore) {}

  private kindForPath(sourcePath: string): string | null {
    const parts = sourcePath.split('/').filter(Boolean);
    if (parts.length === 2 && parts[0] === 'management') return 'management';
    if (parts.length === 2 && parts[0] === 'users') return 'user';
    if (parts.length === 4 && parts[0] === 'users') {
      const byCollection: Record<string, string> = {
        employees: 'employee', clients: 'client', cards: 'card', reviews: 'review',
      };
      return byCollection[parts[2]] ?? null;
    }
    if (parts.length === 2 && ['certificate', 'gallery', 'audit'].includes(parts[0])) {
      return parts[0];
    }
    return null;
  }

  hydrateDocument<T extends Record<string, any>>(
    sourcePath: string,
    baseData: T
  ): Observable<T> {
    return this.readControl$.pipe(
      switchMap((control) => {
        const kind = this.kindForPath(sourcePath);
        const enabled = control?.readFromV2 === true &&
          control?.killSwitch !== true && Boolean(kind) &&
          Array.isArray(control?.readKinds) && control.readKinds.includes(kind!);
        if (!enabled) return of(baseData);
        return this.afs
          .collection<FirestoreV2CompactProjectionDocument>(
            `${sourcePath}/firestoreV2ReadMonths`
          )
          .valueChanges()
          .pipe(
            map((documents) => {
              if (!documents.length) {
                return baseData;
              }
              return reconstructCompactLegacyDocument(
                sourcePath,
                documents,
                baseData
              );
            }),
            catchError((error) => {
              console.error(
                `Firestore v2 projection read failed for ${sourcePath}; using legacy data.`,
                error
              );
              return of(baseData);
            })
          );
      })
    );
  }
}
