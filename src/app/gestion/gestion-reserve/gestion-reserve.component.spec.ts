import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionReserveComponent } from './gestion-reserve.component';

describe('GestionReserveComponent', () => {
  let component: GestionReserveComponent;
  let fixture: ComponentFixture<GestionReserveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionReserveComponent]
    });
    fixture = TestBed.createComponent(GestionReserveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
