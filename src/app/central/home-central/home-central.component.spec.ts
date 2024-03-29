import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeCentralComponent } from './home-central.component';

describe('HomeCentralComponent', () => {
  let component: HomeCentralComponent;
  let fixture: ComponentFixture<HomeCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HomeCentralComponent]
    });
    fixture = TestBed.createComponent(HomeCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
