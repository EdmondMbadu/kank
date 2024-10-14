import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientInfoSavingsComponent } from './client-info-savings.component';

describe('ClientInfoSavingsComponent', () => {
  let component: ClientInfoSavingsComponent;
  let fixture: ComponentFixture<ClientInfoSavingsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ClientInfoSavingsComponent]
    });
    fixture = TestBed.createComponent(ClientInfoSavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
