import { Component } from '@angular/core';
import { AppUpdateService } from './services/app-update.service';
import { ChunkLoadRecoveryService } from './services/chunk-load-recovery.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'kank';

  readonly updateNotice$ = this.appUpdates.notice$;
  readonly chunkFailure$ = this.chunkRecovery.failure$;

  constructor(
    readonly appUpdates: AppUpdateService,
    readonly chunkRecovery: ChunkLoadRecoveryService
  ) {}
}
