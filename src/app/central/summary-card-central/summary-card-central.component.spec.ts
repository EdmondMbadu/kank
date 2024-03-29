import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SummaryCardCentralComponent } from './summary-card-central.component';

describe('SummaryCardCentralComponent', () => {
  let component: SummaryCardCentralComponent;
  let fixture: ComponentFixture<SummaryCardCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SummaryCardCentralComponent]
    });
    fixture = TestBed.createComponent(SummaryCardCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
