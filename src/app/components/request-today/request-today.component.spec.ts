import { of } from 'rxjs';

import { Client } from 'src/app/models/client';
import { TimeService } from 'src/app/services/time.service';
import { RequestTodayComponent } from './request-today.component';

describe('RequestTodayComponent', () => {
  const requestTimestamp = '8-16-2026-9-30-0';
  let client: Client;
  let component: RequestTodayComponent;

  beforeEach(() => {
    client = {
      firstName: 'José',
      lastName: 'Mushiya',
      middleName: 'Muswamba',
      requestAmount: '120000',
      requestDate: '8-17-2026',
      requestStatus: 'pending',
      requestType: 'savings',
      dateOfRequest: requestTimestamp,
    } as Client;

    const auth = jasmine.createSpyObj('AuthService', [
      'getAllClients',
      'getAllClientsCard',
    ]);
    auth.getAllClients.and.returnValue(of([client]));
    auth.getAllClientsCard.and.returnValue(of([]));

    component = new RequestTodayComponent(
      {} as any,
      auth,
      new TimeService()
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the raw request timestamp when another date is selected', () => {
    component.requestDate = '2026-08-17';

    component.otherDate();
    component.requestDate = '2026-08-18';
    component.otherDate();
    component.requestDate = '2026-08-17';
    component.otherDate();

    expect(client.dateOfRequest).toBe(requestTimestamp);
    expect(component.clientsRequestSavings).toEqual([client]);
    const formattedRequestDate = 'Dimanche 16 Août 2026 à 09:30';
    expect(component.formatRequestDate(client.dateOfRequest)).toBe(
      formattedRequestDate
    );
    expect(component.formatRequestDate(formattedRequestDate)).toBe(
      formattedRequestDate
    );
  });
});
