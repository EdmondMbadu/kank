import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReturnClientCardComponent } from './return-client-card.component';

describe('ReturnClientCardComponent', () => {
  let component: ReturnClientCardComponent;
  let fixture: ComponentFixture<ReturnClientCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReturnClientCardComponent]
    });
    fixture = TestBed.createComponent(ReturnClientCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
