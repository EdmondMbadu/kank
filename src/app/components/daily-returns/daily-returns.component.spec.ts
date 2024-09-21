import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyReturnsComponent } from './daily-returns.component';

describe('DailyReturnsComponent', () => {
  let component: DailyReturnsComponent;
  let fixture: ComponentFixture<DailyReturnsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyReturnsComponent]
    });
    fixture = TestBed.createComponent(DailyReturnsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
