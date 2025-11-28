import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

type NavigatorConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

@Injectable({ providedIn: 'root' })
export class NetworkAwarePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const shouldPreload = route.data?.['preload'];
    if (!shouldPreload || this.shouldSkipPreload()) {
      return of(null);
    }

    const delay = Number(route.data?.['preloadDelay'] ?? 0);
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
    const slowConnections = ['slow-2g', '2g'];
    return slowConnections.includes(nav.effectiveType ?? '');
  }
}
