import { of } from 'rxjs';

import { Client } from 'src/app/models/client';
import { TimeService } from 'src/app/services/time.service';
import { RequestTomorrowComponent } from './request-tomorrow.component';

describe('RequestTomorrowComponent', () => {
  const requestTimestamp = '8-10-2026-9-30-0';
  let client: Client;
  let component: RequestTomorrowComponent;

  beforeEach(() => {
    client = {
      firstName: 'José',
      lastName: 'Mushiya',
      middleName: 'Muswamba',
      requestAmount: '120000',
      requestDate: '8-11-2026',
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

    component = new RequestTomorrowComponent(
      {} as any,
      auth,
      new TimeService()
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the raw request timestamp when another date is selected', () => {
    component.requestDate = '2026-08-11';

    component.otherDate();
    component.requestDate = '2026-08-12';
    component.otherDate();
    component.requestDate = '2026-08-11';
    component.otherDate();

    expect(client.dateOfRequest).toBe(requestTimestamp);
    expect(component.clientsRequestSavings).toEqual([client]);
    const formattedRequestDate = 'Lundi 10 Août 2026 à 09:30';
    expect(component.formatRequestDate(client.dateOfRequest)).toBe(
      formattedRequestDate
    );
    expect(component.formatRequestDate(formattedRequestDate)).toBe(
      formattedRequestDate
    );
  });
});
