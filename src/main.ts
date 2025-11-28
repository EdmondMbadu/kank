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
      .catch((err) =>
        console.error('Service worker registration failed', err)
      );
  });
}
