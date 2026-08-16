import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ChunkLoadRecoveryService } from 'src/app/services/chunk-load-recovery.service';
import { PublicAuthService } from 'src/app/services/public-auth.service';

import { LandingPageComponent, loginErrorMessage } from './landing-page.component';

describe('LandingPageComponent', () => {
  let component: LandingPageComponent;
  let fixture: ComponentFixture<LandingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RouterTestingModule],
      declarations: [LandingPageComponent],
      providers: [
        {
          provide: PublicAuthService,
          useValue: { SignOn: jasmine.createSpy('SignOn') },
        },
        {
          provide: ChunkLoadRecoveryService,
          useValue: { handle: jasmine.createSpy('handle').and.returnValue(false) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a friendly message for a transient Firebase network failure', () => {
    expect(
      loginErrorMessage({ code: 'auth/network-request-failed' })
    ).toBe(
      'Connexion internet interrompue. Vérifiez le réseau puis réessayez.'
    );
  });

  it('does not report a network failure as a bad password', () => {
    expect(loginErrorMessage({ code: 'auth/network-request-failed' })).not.toBe(
      loginErrorMessage({ code: 'auth/invalid-credential' })
    );
  });
});
