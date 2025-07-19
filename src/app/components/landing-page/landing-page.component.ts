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

  /** ❷ Déclenché au clic sur « Se Connecter » */
  async SignOn() {
    if (!this.email || !this.password) {
      alert('Veuillez renseigner tous les champs.');
      return;
    }

    this.isLoading = true; // montre le loader tout de suite
    try {
      await this.auth.SignOn(this.email, this.password, this.word);
      // Le routeur redirige vers /home ⇒ isLoading sera repassé à false par le hook ci-dessus
    } catch (err: any) {
      this.isLoading = false; // échec d’authentification
      alert(err?.message ?? 'Erreur inconnue');
    }
  }
}
