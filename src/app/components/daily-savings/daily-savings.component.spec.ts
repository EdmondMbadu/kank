import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailySavingsComponent } from './daily-savings.component';

describe('DailySavingsComponent', () => {
  let component: DailySavingsComponent;
  let fixture: ComponentFixture<DailySavingsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailySavingsComponent]
    });
    fixture = TestBed.createComponent(DailySavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
