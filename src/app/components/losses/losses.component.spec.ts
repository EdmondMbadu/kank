import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LossesComponent } from './losses.component';

describe('LossesComponent', () => {
  let component: LossesComponent;
  let fixture: ComponentFixture<LossesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LossesComponent]
    });
    fixture = TestBed.createComponent(LossesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
