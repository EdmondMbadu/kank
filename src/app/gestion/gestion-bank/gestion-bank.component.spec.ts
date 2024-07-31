import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionBankComponent } from './gestion-bank.component';

describe('GestionBankComponent', () => {
  let component: GestionBankComponent;
  let fixture: ComponentFixture<GestionBankComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionBankComponent]
    });
    fixture = TestBed.createComponent(GestionBankComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
