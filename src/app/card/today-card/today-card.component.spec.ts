import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TodayCardComponent } from './today-card.component';

describe('TodayCardComponent', () => {
  let component: TodayCardComponent;
  let fixture: ComponentFixture<TodayCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TodayCardComponent]
    });
    fixture = TestBed.createComponent(TodayCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
