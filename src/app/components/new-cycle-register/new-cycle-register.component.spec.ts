import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewCycleRegisterComponent } from './new-cycle-register.component';

describe('NewCycleRegisterComponent', () => {
  let component: NewCycleRegisterComponent;
  let fixture: ComponentFixture<NewCycleRegisterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NewCycleRegisterComponent]
    });
    fixture = TestBed.createComponent(NewCycleRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
