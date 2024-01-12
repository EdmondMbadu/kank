import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetraceComponent } from './retrace.component';

describe('RetraceComponent', () => {
  let component: RetraceComponent;
  let fixture: ComponentFixture<RetraceComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RetraceComponent]
    });
    fixture = TestBed.createComponent(RetraceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
