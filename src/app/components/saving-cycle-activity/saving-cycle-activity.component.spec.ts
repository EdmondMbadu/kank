import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavingCycleActivityComponent } from './saving-cycle-activity.component';

describe('SavingCycleActivityComponent', () => {
  let component: SavingCycleActivityComponent;
  let fixture: ComponentFixture<SavingCycleActivityComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SavingCycleActivityComponent]
    });
    fixture = TestBed.createComponent(SavingCycleActivityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
