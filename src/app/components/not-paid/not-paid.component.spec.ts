import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotPaidComponent } from './not-paid.component';

describe('NotPaidComponent', () => {
  let component: NotPaidComponent;
  let fixture: ComponentFixture<NotPaidComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NotPaidComponent]
    });
    fixture = TestBed.createComponent(NotPaidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
