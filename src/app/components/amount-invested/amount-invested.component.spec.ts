import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmountInvestedComponent } from './amount-invested.component';

describe('AmountInvestedComponent', () => {
  let component: AmountInvestedComponent;
  let fixture: ComponentFixture<AmountInvestedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AmountInvestedComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AmountInvestedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
