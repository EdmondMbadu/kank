import { Inject, Injectable, Optional } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { BehaviorSubject, filter } from 'rxjs';
import { APP_RELOAD } from './app-reload.token';

export interface AppUpdateNotice {
  message: string;
  urgent: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly noticeSubject = new BehaviorSubject<AppUpdateNotice | null>(
    null
  );
  readonly notice$ = this.noticeSubject.asObservable();

  constructor(
    @Optional() private readonly updates: SwUpdate | null,
    @Inject(APP_RELOAD) private readonly reloadPage: () => void
  ) {
    if (!this.updates?.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(
        filter(
          (event): event is VersionReadyEvent => event.type === 'VERSION_READY'
        )
      )
      .subscribe(() => {
        this.noticeSubject.next({
          message:
            'Une nouvelle version est disponible. Actualisez uniquement lorsqu\u2019aucune opération n\u2019est en cours.',
          urgent: false,
        });
      });

    this.updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_INSTALLATION_FAILED') {
        console.error('Application update failed', event);
      }
    });

    this.updates.unrecoverable.subscribe((event) => {
      console.error('Unrecoverable application version', event.reason);
      this.noticeSubject.next({
        message:
          'Cette version de l\u2019application ne peut plus continuer. Actualisez la page avant de poursuivre.',
        urgent: true,
      });
    });
  }

  reload(): void {
    this.reloadPage();
  }

  dismiss(): void {
    this.noticeSubject.next(null);
  }
}
