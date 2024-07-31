import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionServedComponent } from './gestion-served.component';

describe('GestionServedComponent', () => {
  let component: GestionServedComponent;
  let fixture: ComponentFixture<GestionServedComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionServedComponent]
    });
    fixture = TestBed.createComponent(GestionServedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
