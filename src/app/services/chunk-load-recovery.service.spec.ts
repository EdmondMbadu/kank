import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { APP_RELOAD } from './app-reload.token';
import {
  chunkFailureSignature,
  ChunkLoadRecoveryService,
  isChunkLoadError,
} from './chunk-load-recovery.service';

describe('ChunkLoadRecoveryService', () => {
  let reload: jasmine.Spy;

  beforeEach(() => {
    sessionStorage.clear();
    reload = jasmine.createSpy('reload');
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: APP_RELOAD, useValue: reload }],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('recognizes known lazy chunk failures without matching Firebase network errors', () => {
    expect(
      isChunkLoadError(
        new Error(
          'Loading chunk 539 failed. (error: https://example.test/539.693e9b1d849a524d.js)'
        )
      )
    ).toBeTrue();
    expect(
      isChunkLoadError({
        code: 'auth/network-request-failed',
        message: 'Firebase: Error (auth/network-request-failed).',
      })
    ).toBeFalse();
  });

  it('uses the failed hashed asset as the recovery signature', () => {
    expect(
      chunkFailureSignature(
        'Loading chunk 539 failed: https://example.test/539.693e9b1d849a524d.js'
      )
    ).toContain('539.693e9b1d849a524d.js');
  });

  it('reloads once and blocks the same failure after the reload', () => {
    const router = TestBed.inject(Router);
    const document = TestBed.inject(DOCUMENT);
    const firstInstance = new ChunkLoadRecoveryService(
      router,
      document,
      reload
    );
    const error = new Error(
      'Loading chunk 539 failed. (error: https://example.test/539.693e9b1d849a524d.js)'
    );

    expect(firstInstance.handle(error)).toBeTrue();
    expect(reload).toHaveBeenCalledTimes(1);

    const secondInstance = new ChunkLoadRecoveryService(
      router,
      document,
      reload
    );
    let failureMessage: string | null = null;
    secondInstance.failure$.subscribe((message) => (failureMessage = message));

    expect(secondInstance.handle(error)).toBeTrue();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(failureMessage).toContain('mise à jour automatique');
  });
});
