import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeePageComponent } from './employee-page.component';

describe('EmployeePageComponent', () => {
  let component: EmployeePageComponent;
  let fixture: ComponentFixture<EmployeePageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EmployeePageComponent]
    });
    fixture = TestBed.createComponent(EmployeePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
