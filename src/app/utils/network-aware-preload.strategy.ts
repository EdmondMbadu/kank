import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

type NavigatorConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
    downlink?: number;
    rtt?: number;
  };
};

@Injectable({ providedIn: 'root' })
export class NetworkAwarePreloadStrategy implements PreloadingStrategy {
  constructor(private auth: AuthService) {}

  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const shouldPreload = route.data?.['preload'];
    if (!shouldPreload || this.shouldSkipPreload()) {
      return of(null);
    }

    const preloadOnAuth = route.data?.['preloadOnAuth'];
    const delay = Number(route.data?.['preloadDelay'] ?? 0);
    if (preloadOnAuth) {
      return this.auth.user$.pipe(
        take(1),
        switchMap((user) => (user ? this.preloadWithDelay(load, delay) : of(null)))
      );
    }
    return this.preloadWithDelay(load, delay);
  }

  private preloadWithDelay(
    load: () => Observable<any>,
    delay: number
  ): Observable<any> {
    if (delay > 0) {
      return timer(delay).pipe(switchMap(() => load()));
    }
    return load();
  }

  private shouldSkipPreload(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    const nav = (navigator as NavigatorConnection).connection;
    if (!nav) {
      return false;
    }
    if (nav.saveData) {
      return true;
    }
    const slowConnections = ['slow-2g', '2g', '3g'];
    if (slowConnections.includes(nav.effectiveType ?? '')) {
      return true;
    }
    if (typeof nav.downlink === 'number' && nav.downlink < 1.3) {
      return true;
    }
    if (typeof nav.rtt === 'number' && nav.rtt > 300) {
      return true;
    }
    return false;
  }
}
