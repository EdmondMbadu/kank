import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from '../environments/environments';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

if (
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  environment.production
) {
  window?.addEventListener('load', () => {
    navigator.serviceWorker
      .register('ngsw-worker.js')
      .catch((err) => {
        // Only log error if it's not a 404 (file not found in dev)
        if (err?.message && !err.message.includes('404')) {
          console.error('Service worker registration failed', err);
        }
      });
  });
}
