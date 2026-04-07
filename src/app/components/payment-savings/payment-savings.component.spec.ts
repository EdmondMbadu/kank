import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PaymentSavingsComponent } from './payment-savings.component';

describe('PaymentSavingsComponent', () => {
  let component: PaymentSavingsComponent;
  let fixture: ComponentFixture<PaymentSavingsComponent>;

  const savingsClient = Object.assign(new Client(), {
    uid: 'client-0',
    firstName: 'Rebecca',
    lastName: 'Kanku',
    debtLeft: '0',
    savings: '10000',
    creditScore: '70',
  });

  function textContent(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaymentSavingsComponent],
      imports: [FormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '0' }),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: {
              email: 'agent@kank.test',
              firstName: 'Agent',
              savingsRequiredPercent: '30',
            },
            getAllClients: jasmine
              .createSpy('getAllClients')
              .and.returnValue(of([Object.assign(new Client(), savingsClient)])),
          },
        },
        {
          provide: DataService,
          useValue: {
            clientDeposit: jasmine.createSpy('clientDeposit'),
          },
        },
        {
          provide: TimeService,
          useValue: {
            todaysDate: () => '3-20-2026-10-00-00',
            todaysDateMonthDayYear: () => '3-20-2026',
          },
        },
        {
          provide: ComputationService,
          useValue: {
            getMaxLendAmount: () => 350000,
          },
        },
        {
          provide: PerformanceService,
          useValue: {},
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentSavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the savings cap details when the debt is already cleared', () => {
    expect(component.hasClearedDebt).toBeTrue();
    expect(component.maxSavingsTotal).toBe(105000);
    expect(component.remainingSavingsCapacity).toBe(95000);
    expect(textContent()).toContain("Plafond d'épargne autorisé");
  });

  it('hides the savings cap details while debt is still open', () => {
    component.client.debtLeft = '5000';
    fixture.detectChanges();

    expect(component.hasClearedDebt).toBeFalse();
    expect(textContent()).not.toContain("Plafond d'épargne autorisé");
  });
});
