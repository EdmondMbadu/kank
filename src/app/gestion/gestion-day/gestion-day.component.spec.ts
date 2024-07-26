import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionDayComponent } from './gestion-day.component';

describe('GestionDayComponent', () => {
  let component: GestionDayComponent;
  let fixture: ComponentFixture<GestionDayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionDayComponent]
    });
    fixture = TestBed.createComponent(GestionDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
