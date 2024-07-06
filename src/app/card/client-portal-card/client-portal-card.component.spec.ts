import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientPortalCardComponent } from './client-portal-card.component';

describe('ClientPortalCardComponent', () => {
  let component: ClientPortalCardComponent;
  let fixture: ComponentFixture<ClientPortalCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ClientPortalCardComponent]
    });
    fixture = TestBed.createComponent(ClientPortalCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
