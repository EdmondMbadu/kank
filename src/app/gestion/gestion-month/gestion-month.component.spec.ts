import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionMonthComponent } from './gestion-month.component';

describe('GestionMonthComponent', () => {
  let component: GestionMonthComponent;
  let fixture: ComponentFixture<GestionMonthComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionMonthComponent]
    });
    fixture = TestBed.createComponent(GestionMonthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
