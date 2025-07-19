// landing-page.component.ts
import { Component } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent {
  email = '';
  password = '';
  word = '';
  isLoading = false; // <── nouveau

  constructor(private auth: AuthService, private router: Router) {
    /** ❶ Bascule le loader pendant toute navigation */
    this.router.events
      .pipe(filter((ev) => ev instanceof NavigationStart))
      .subscribe(() => (this.isLoading = true));

    this.router.events
      .pipe(
        filter(
          (ev) =>
            ev instanceof NavigationEnd ||
            ev instanceof NavigationCancel ||
            ev instanceof NavigationError
        )
      )
      .subscribe(() => (this.isLoading = false));
  }

  // landing-page.component.ts
  async SignOn() {
    if (!this.email || !this.password) {
      alert('Veuillez completez toutes les données.');
      return;
    }

    this.isLoading = true;

    try {
      await this.auth.SignOn(this.email, this.password, this.word);
      // succès → le hook Router (NavigationEnd) remettra isLoading = false
    } catch (err: any) {
      // échec d’authentification
      this.isLoading = false; // ← spinner disparaît
      const msg =
        err?.code === 'auth/wrong-password'
          ? 'Mot de passe ou email incorrect. Essayer à nouveau.'
          : err?.message ?? 'Échec de connexion.';
      alert(msg);
    }
  }
}
