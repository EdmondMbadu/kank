import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailySavingsReturnsComponent } from './daily-savings-returns.component';

describe('DailySavingsReturnsComponent', () => {
  let component: DailySavingsReturnsComponent;
  let fixture: ComponentFixture<DailySavingsReturnsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailySavingsReturnsComponent]
    });
    fixture = TestBed.createComponent(DailySavingsReturnsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
