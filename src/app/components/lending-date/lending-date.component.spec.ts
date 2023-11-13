import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LendingDateComponent } from './lending-date.component';

describe('LendingDateComponent', () => {
  let component: LendingDateComponent;
  let fixture: ComponentFixture<LendingDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LendingDateComponent]
    });
    fixture = TestBed.createComponent(LendingDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
