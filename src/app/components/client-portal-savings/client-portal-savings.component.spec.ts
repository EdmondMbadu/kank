import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientPortalSavingsComponent } from './client-portal-savings.component';

describe('ClientPortalSavingsComponent', () => {
  let component: ClientPortalSavingsComponent;
  let fixture: ComponentFixture<ClientPortalSavingsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ClientPortalSavingsComponent]
    });
    fixture = TestBed.createComponent(ClientPortalSavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
