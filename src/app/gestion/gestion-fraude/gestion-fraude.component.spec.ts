import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionFraudeComponent } from './gestion-fraude.component';

describe('GestionFraudeComponent', () => {
  let component: GestionFraudeComponent;
  let fixture: ComponentFixture<GestionFraudeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GestionFraudeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionFraudeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
