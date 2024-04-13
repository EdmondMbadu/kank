import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransformRegisterClientComponent } from './transform-register-client.component';

describe('TransformRegisterClientComponent', () => {
  let component: TransformRegisterClientComponent;
  let fixture: ComponentFixture<TransformRegisterClientComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TransformRegisterClientComponent]
    });
    fixture = TestBed.createComponent(TransformRegisterClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
