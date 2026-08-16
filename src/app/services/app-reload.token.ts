import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

export const APP_RELOAD = new InjectionToken<() => void>('APP_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.defaultView?.location.reload();
  },
});
