import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of, throwError } from 'rxjs';
import {
  catchError,
  map,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs/operators';
import {
  FirestoreV2CompactProjectionDocument,
  FirestoreV2ProjectionDocument,
  hasChunkedProjection,
  reconstructCompactLegacyDocument,
  reconstructLegacyDocument,
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

  private projectionDocuments<T>(
    sourcePath: string, collectionName: string, monthKey?: string
  ): Observable<T[]> {
    if (monthKey) {
      return this.afs.doc<T>(`${sourcePath}/${collectionName}/${monthKey}`)
        .valueChanges().pipe(map((document) => document ? [document] : []));
    }
    return this.afs.collection<T>(`${sourcePath}/${collectionName}`).valueChanges();
  }

  private hydrateFromIntegrityProjection<T extends Record<string, any>>(
    sourcePath: string,
    baseData: T,
    compactError?: unknown,
    monthKey?: string
  ): Observable<T> {
    return this.projectionDocuments<FirestoreV2ProjectionDocument>(
      sourcePath, 'firestoreV2Months', monthKey
    ).pipe(
        retry({ count: 3, delay: 1000 }),
        switchMap((documents) => {
          if ((!documents.length && !monthKey) || hasChunkedProjection(sourcePath, documents)) {
            return throwError(() => new Error(
              `No complete Firestore v2 fallback exists for ${sourcePath}.`
            ));
          }
          return of(reconstructLegacyDocument(sourcePath, documents, baseData));
        }),
        catchError((fallbackError) => {
          console.error(
            `Firestore v2 fallback failed for ${sourcePath}; refusing partial history.`,
            { compactError, fallbackError }
          );
          return throwError(() => fallbackError);
        })
      );
  }

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
    baseData: T,
    // Opt-in partial history for read-only daily details. Existing consumers
    // still receive the complete history by leaving this argument undefined.
    monthKey?: string
  ): Observable<T> {
    if (monthKey !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
      return throwError(() => new Error('Invalid Firestore history month.'));
    }
    return this.readControl$.pipe(
      switchMap((control) => {
        const kind = this.kindForPath(sourcePath);
        const enabled = control?.readFromV2 === true &&
          control?.killSwitch !== true && Boolean(kind) &&
          Array.isArray(control?.readKinds) && control.readKinds.includes(kind!);
        if (!enabled) return of(baseData);
        const archived = Boolean(baseData?.['_firestoreV2Archive']);
        return this.projectionDocuments<FirestoreV2CompactProjectionDocument>(
          sourcePath, 'firestoreV2ReadMonths', monthKey
        ).pipe(
            retry({ count: 3, delay: 1000 }),
            switchMap((documents) => {
              if (!documents.length) {
                return archived
                  ? this.hydrateFromIntegrityProjection(sourcePath, baseData, undefined, monthKey)
                  : of(baseData);
              }
              return of(
                reconstructCompactLegacyDocument(
                  sourcePath,
                  documents,
                  baseData
                )
              );
            }),
            catchError((error) => {
              console.error(
                `Firestore v2 compact projection read failed for ${sourcePath}.`,
                error
              );
              return archived
                ? this.hydrateFromIntegrityProjection(sourcePath, baseData, error, monthKey)
                : monthKey ? throwError(() => error) : of(baseData);
            })
          );
      })
    );
  }
}
