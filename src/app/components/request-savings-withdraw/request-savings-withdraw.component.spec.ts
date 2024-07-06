import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestSavingsWithdrawComponent } from './request-savings-withdraw.component';

describe('RequestSavingsWithdrawComponent', () => {
  let component: RequestSavingsWithdrawComponent;
  let fixture: ComponentFixture<RequestSavingsWithdrawComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequestSavingsWithdrawComponent]
    });
    fixture = TestBed.createComponent(RequestSavingsWithdrawComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
