import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DebtCycleComponent } from './debt-cycle.component';

describe('DebtCycleComponent', () => {
  let component: DebtCycleComponent;
  let fixture: ComponentFixture<DebtCycleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DebtCycleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DebtCycleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
