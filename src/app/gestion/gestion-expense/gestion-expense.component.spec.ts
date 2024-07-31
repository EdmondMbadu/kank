import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionExpenseComponent } from './gestion-expense.component';

describe('GestionExpenseComponent', () => {
  let component: GestionExpenseComponent;
  let fixture: ComponentFixture<GestionExpenseComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionExpenseComponent]
    });
    fixture = TestBed.createComponent(GestionExpenseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
