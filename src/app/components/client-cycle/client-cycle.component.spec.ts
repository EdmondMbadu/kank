import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientCycleComponent } from './client-cycle.component';

describe('ClientCycleComponent', () => {
  let component: ClientCycleComponent;
  let fixture: ComponentFixture<ClientCycleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ClientCycleComponent]
    });
    fixture = TestBed.createComponent(ClientCycleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
