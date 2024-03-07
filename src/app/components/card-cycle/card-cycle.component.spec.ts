import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardCycleComponent } from './card-cycle.component';

describe('CardCycleComponent', () => {
  let component: CardCycleComponent;
  let fixture: ComponentFixture<CardCycleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CardCycleComponent]
    });
    fixture = TestBed.createComponent(CardCycleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
