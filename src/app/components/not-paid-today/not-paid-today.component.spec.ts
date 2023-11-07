import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotPaidTodayComponent } from './not-paid-today.component';

describe('NotPaidTodayComponent', () => {
  let component: NotPaidTodayComponent;
  let fixture: ComponentFixture<NotPaidTodayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NotPaidTodayComponent]
    });
    fixture = TestBed.createComponent(NotPaidTodayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
