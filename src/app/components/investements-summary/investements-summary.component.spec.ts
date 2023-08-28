import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvestementsSummaryComponent } from './investements-summary.component';

describe('InvestementsSummaryComponent', () => {
  let component: InvestementsSummaryComponent;
  let fixture: ComponentFixture<InvestementsSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InvestementsSummaryComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvestementsSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
