import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegiserPortalComponent } from './register-portal.component';

describe('RegiserPortalComponent', () => {
  let component: RegiserPortalComponent;
  let fixture: ComponentFixture<RegiserPortalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RegiserPortalComponent],
    });
    fixture = TestBed.createComponent(RegiserPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
