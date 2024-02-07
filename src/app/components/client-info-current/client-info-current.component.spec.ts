import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientInfoCurrentComponent } from './client-info-current.component';

describe('ClientInfoCurrentComponent', () => {
  let component: ClientInfoCurrentComponent;
  let fixture: ComponentFixture<ClientInfoCurrentComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ClientInfoCurrentComponent]
    });
    fixture = TestBed.createComponent(ClientInfoCurrentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
