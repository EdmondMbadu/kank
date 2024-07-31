import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionInvestmentComponent } from './gestion-investment.component';

describe('GestionInvestmentComponent', () => {
  let component: GestionInvestmentComponent;
  let fixture: ComponentFixture<GestionInvestmentComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionInvestmentComponent]
    });
    fixture = TestBed.createComponent(GestionInvestmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
