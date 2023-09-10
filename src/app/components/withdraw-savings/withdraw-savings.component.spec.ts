import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WithdrawSavingsComponent } from './withdraw-savings.component';

describe('WithdrawSavingsComponent', () => {
  let component: WithdrawSavingsComponent;
  let fixture: ComponentFixture<WithdrawSavingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WithdrawSavingsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WithdrawSavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
