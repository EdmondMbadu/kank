import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateClientInfoComponent } from './update-client-info.component';

describe('UpdateClientInfoComponent', () => {
  let component: UpdateClientInfoComponent;
  let fixture: ComponentFixture<UpdateClientInfoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [UpdateClientInfoComponent]
    });
    fixture = TestBed.createComponent(UpdateClientInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
