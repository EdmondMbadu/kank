import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyCardReturnsComponent } from './daily-card-returns.component';

describe('DailyCardReturnsComponent', () => {
  let component: DailyCardReturnsComponent;
  let fixture: ComponentFixture<DailyCardReturnsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyCardReturnsComponent]
    });
    fixture = TestBed.createComponent(DailyCardReturnsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
