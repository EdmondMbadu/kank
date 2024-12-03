import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinishedDebtComponent } from './finished-debt.component';

describe('FinishedDebtComponent', () => {
  let component: FinishedDebtComponent;
  let fixture: ComponentFixture<FinishedDebtComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FinishedDebtComponent]
    });
    fixture = TestBed.createComponent(FinishedDebtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
