import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestTomorrowComponent } from './request-tomorrow.component';

describe('RequestTomorrowComponent', () => {
  let component: RequestTomorrowComponent;
  let fixture: ComponentFixture<RequestTomorrowComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequestTomorrowComponent]
    });
    fixture = TestBed.createComponent(RequestTomorrowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
