import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionLossComponent } from './gestion-loss.component';

describe('GestionLossComponent', () => {
  let component: GestionLossComponent;
  let fixture: ComponentFixture<GestionLossComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GestionLossComponent]
    });
    fixture = TestBed.createComponent(GestionLossComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
