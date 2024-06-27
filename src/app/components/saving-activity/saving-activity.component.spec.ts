import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavingActivityComponent } from './saving-activity.component';

describe('SavingActivityComponent', () => {
  let component: SavingActivityComponent;
  let fixture: ComponentFixture<SavingActivityComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SavingActivityComponent]
    });
    fixture = TestBed.createComponent(SavingActivityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
