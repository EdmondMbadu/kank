// landing-page.component.ts
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { PublicAuthService } from 'src/app/services/public-auth.service';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { ChunkLoadRecoveryService } from 'src/app/services/chunk-load-recovery.service';

export function loginErrorMessage(error: any): string {
  switch (error?.code) {
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Mot de passe ou email incorrect. Essayez à nouveau.';
    case 'auth/network-request-failed':
      return 'Connexion internet interrompue. Vérifiez le réseau puis réessayez.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Patientez un moment avant de réessayer.';
    default:
      return error?.message ?? 'Échec de connexion.';
  }
}

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent implements OnDestroy {
  email = '';
  password = '';
  word = '';
  isLoading = false; // <── nouveau
  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: PublicAuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private chunkRecovery: ChunkLoadRecoveryService
  ) {
    /** ❶ Bascule le loader pendant toute navigation */
    this.router.events
      .pipe(
        filter((ev) => ev instanceof NavigationStart),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.isLoading = true;
        this.cdr.markForCheck();
      });

    this.router.events
      .pipe(
        filter(
          (ev) =>
            ev instanceof NavigationEnd ||
            ev instanceof NavigationCancel ||
            ev instanceof NavigationError
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  // landing-page.component.ts
  async SignOn() {
    if (!this.email || !this.password) {
      alert('Veuillez completez toutes les données.');
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      await this.auth.SignOn(this.email, this.password, this.word);
      // succès → le hook Router (NavigationEnd) remettra isLoading = false
    } catch (err: any) {
      // échec d’authentification
      this.isLoading = false; // ← spinner disparaît
      if (!this.chunkRecovery.handle(err)) {
        alert(loginErrorMessage(err));
      }
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
