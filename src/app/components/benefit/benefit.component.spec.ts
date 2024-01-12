import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenefitComponent } from './benefit.component';

describe('BenefitComponent', () => {
  let component: BenefitComponent;
  let fixture: ComponentFixture<BenefitComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BenefitComponent]
    });
    fixture = TestBed.createComponent(BenefitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
