import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaidDateComponent } from './paid-date.component';

describe('PaidDateComponent', () => {
  let component: PaidDateComponent;
  let fixture: ComponentFixture<PaidDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PaidDateComponent]
    });
    fixture = TestBed.createComponent(PaidDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
