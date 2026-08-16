import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { NavigationError, Router } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';
import { APP_RELOAD } from './app-reload.token';

const RECOVERY_KEY = 'kank:chunk-recovery-signature';

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading (?:CSS )?chunk [^ ]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

function errorText(value: unknown, depth = 0): string {
  if (value == null || depth > 2) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    const nested = (value as Error & { cause?: unknown }).cause;
    return [value.name, value.message, value.stack, errorText(nested, depth + 1)]
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    const candidate = value as {
      name?: unknown;
      message?: unknown;
      stack?: unknown;
      reason?: unknown;
      cause?: unknown;
      filename?: unknown;
    };
    return [
      candidate.name,
      candidate.message,
      candidate.stack,
      candidate.filename,
      errorText(candidate.reason, depth + 1),
      errorText(candidate.cause, depth + 1),
    ]
      .filter((part) => typeof part === 'string' && part.length > 0)
      .join('\n');
  }
  return String(value);
}

export function isChunkLoadError(value: unknown): boolean {
  const text = errorText(value);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function chunkFailureSignature(value: unknown, path = ''): string {
  const text = errorText(value);
  const file = text.match(
    /(?:https?:\/\/[^\s)]+\/)?[^\s/)]+\.[a-f0-9]{8,}\.(?:js|css)(?:\?[^\s)]*)?/i
  )?.[0];
  return file || `${path}:${text.slice(0, 180)}`;
}

@Injectable({ providedIn: 'root' })
export class ChunkLoadRecoveryService {
  private readonly failureSubject = new BehaviorSubject<string | null>(null);
  readonly failure$ = this.failureSubject.asObservable();
  private reloadScheduled = false;
  private readonly window: Window | null;

  constructor(
    router: Router,
    @Inject(DOCUMENT) document: Document,
    @Inject(APP_RELOAD) private readonly reloadPage: () => void
  ) {
    this.window = document.defaultView;

    router.events
      .pipe(
        filter(
          (event): event is NavigationError => event instanceof NavigationError
        )
      )
      .subscribe((event) => this.handle(event.error));

    this.window?.addEventListener('error', (event) => this.handle(event));
    this.window?.addEventListener('unhandledrejection', (event) =>
      this.handle(event.reason)
    );
  }

  handle(error: unknown): boolean {
    if (!isChunkLoadError(error)) {
      return false;
    }
    if (this.reloadScheduled) {
      return true;
    }

    const signature = chunkFailureSignature(
      error,
      this.window?.location.pathname || ''
    );
    const storage = this.safeSessionStorage();
    const previousSignature = storage?.getItem(RECOVERY_KEY);

    if (previousSignature === signature) {
      console.error(
        'Chunk loading failed again after automatic recovery',
        error
      );
      this.failureSubject.next(
        'La mise à jour automatique n\u2019a pas réussi. Vérifiez la connexion, puis réessayez.'
      );
      return true;
    }

    storage?.setItem(RECOVERY_KEY, signature);
    this.reloadScheduled = true;
    console.warn(
      'Recovering from a stale or interrupted application chunk',
      error
    );
    this.reloadPage();
    return true;
  }

  retryManually(): void {
    this.safeSessionStorage()?.removeItem(RECOVERY_KEY);
    this.reloadPage();
  }

  dismiss(): void {
    this.failureSubject.next(null);
  }

  private safeSessionStorage(): Storage | null {
    try {
      return this.window?.sessionStorage || null;
    } catch {
      return null;
    }
  }
}
