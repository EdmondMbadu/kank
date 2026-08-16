import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { APP_RELOAD } from './app-reload.token';
import { AppUpdateNotice, AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<any>;
  let unrecoverable: Subject<any>;
  let reload: jasmine.Spy;

  beforeEach(() => {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    reload = jasmine.createSpy('reload');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: { isEnabled: true, versionUpdates, unrecoverable },
        },
        { provide: APP_RELOAD, useValue: reload },
      ],
    });
  });

  it('offers a non-urgent refresh when a complete version is ready', () => {
    const service = TestBed.inject(AppUpdateService);
    const notices: Array<AppUpdateNotice | null> = [];
    service.notice$.subscribe((value) => notices.push(value));

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(notices[notices.length - 1]?.urgent).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
  });

  it('marks an unrecoverable version as urgent without reloading automatically', () => {
    const service = TestBed.inject(AppUpdateService);
    const notices: Array<AppUpdateNotice | null> = [];
    service.notice$.subscribe((value) => notices.push(value));

    unrecoverable.next({ reason: 'missing cached chunk' });

    expect(notices[notices.length - 1]?.urgent).toBeTrue();
    expect(reload).not.toHaveBeenCalled();
  });

});
