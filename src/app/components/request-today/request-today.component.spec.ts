import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestTodayComponent } from './request-today.component';

describe('RequestTodayComponent', () => {
  let component: RequestTodayComponent;
  let fixture: ComponentFixture<RequestTodayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequestTodayComponent]
    });
    fixture = TestBed.createComponent(RequestTodayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
