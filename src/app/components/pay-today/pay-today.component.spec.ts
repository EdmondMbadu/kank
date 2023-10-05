import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PayTodayComponent } from './pay-today.component';

describe('PayTodayComponent', () => {
  let component: PayTodayComponent;
  let fixture: ComponentFixture<PayTodayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PayTodayComponent]
    });
    fixture = TestBed.createComponent(PayTodayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
