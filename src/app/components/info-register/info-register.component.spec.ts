import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { InfoRegisterComponent } from './info-register.component';
import { AuthService } from 'src/app/services/auth.service';
import { Client } from 'src/app/models/client';

describe('InfoRegisterComponent', () => {
  let component: InfoRegisterComponent;
  let fixture: ComponentFixture<InfoRegisterComponent>;

  const clients: Client[] = [
    {
      uid: 'verified-client',
      firstName: 'Amina',
      lastName: 'Kasongo',
      phoneNumber: '243999111222',
      amountPaid: '2500',
      debtLeft: '5000',
      type: 'register',
      agentSubmittedVerification: 'true',
    },
    {
      uid: 'rejected-client',
      firstName: 'Blaise',
      lastName: 'Mukendi',
      phoneNumber: '243999111333',
      amountPaid: '1000',
      debtLeft: '4000',
      type: 'register',
      requestType: 'rejection',
    },
    {
      uid: 'unverified-client',
      firstName: 'Chantal',
      lastName: 'Ilunga',
      phoneNumber: '243999111444',
      amountPaid: '700',
      debtLeft: '3000',
      type: 'register',
      agentSubmittedVerification: 'false',
    },
    {
      uid: 'standard-client',
      firstName: 'David',
      lastName: 'Mbuyi',
      phoneNumber: '243999111555',
      amountPaid: '1200',
      debtLeft: '0',
      type: 'loan',
    },
  ];

  const authServiceStub = {
    currentUser: {
      email: 'agent@example.com',
      firstName: 'Agent',
    },
    getAllClients: jasmine.createSpy('getAllClients').and.returnValue(of(clients)),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [InfoRegisterComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authServiceStub }],
      schemas: [NO_ERRORS_SCHEMA],
    });

    fixture = TestBed.createComponent(InfoRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep only register clients and expose their verification status', () => {
    expect(component.filteredItems.length).toBe(3);

    expect(component.filteredItems.map((client) => client.trackingId)).toEqual([
      '0',
      '1',
      '2',
    ]);

    expect(
      component.filteredItems.map((client) => ({
        uid: client.uid,
        state: client.verificationState,
        label: client.verificationLabel,
      }))
    ).toEqual([
      {
        uid: 'verified-client',
        state: 'verified',
        label: 'Vérifié',
      },
      {
        uid: 'rejected-client',
        state: 'rejected',
        label: 'Rejet en cours',
      },
      {
        uid: 'unverified-client',
        state: 'unverified',
        label: 'Non vérifié',
      },
    ]);
  });

  it('should use the same verification flag as the register portal', () => {
    expect(component.isClientVerified(clients[0])).toBeTrue();
    expect(component.isClientVerified(clients[1])).toBeFalse();
    expect(component.isClientVerified(clients[2])).toBeFalse();
  });
});
