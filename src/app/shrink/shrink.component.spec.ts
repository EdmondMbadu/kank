import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShrinkComponent } from './shrink.component';

describe('ShrinkComponent', () => {
  let component: ShrinkComponent;
  let fixture: ComponentFixture<ShrinkComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ShrinkComponent]
    });
    fixture = TestBed.createComponent(ShrinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
