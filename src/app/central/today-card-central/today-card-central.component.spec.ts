import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TodayCardCentralComponent } from './today-card-central.component';

describe('TodayCardCentralComponent', () => {
  let component: TodayCardCentralComponent;
  let fixture: ComponentFixture<TodayCardCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TodayCardCentralComponent]
    });
    fixture = TestBed.createComponent(TodayCardCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
