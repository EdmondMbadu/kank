import { RegiserPortalComponent } from './register-portal.component';

describe('RegiserPortalComponent', () => {
  let component: RegiserPortalComponent;

  beforeEach(() => {
    component = new RegiserPortalComponent(
      {} as any,
      {
        snapshot: {
          paramMap: { get: () => '7' },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats the client request submission date in French', () => {
    component.client.dateOfRequest = '8-11-2026-9-30-0';

    const label = (component as any).resolveRequestSubmittedDateLabel();

    expect(label).toBe('mardi 11 août 2026');
  });

  it('formats the planned delivery date while preserving its compact value', () => {
    component.requestDate = '14/3/2026';

    component.requestDeliveryDateLabel = (component as any).formatFrenchLongDate(
      '3-14-2026'
    );

    expect(component.requestDeliveryDateLabel).toBe('samedi 14 mars 2026');
    expect(component.requestDate).toBe('14/3/2026');
  });

  it('prefers the matching audit request date over the client fallback', () => {
    component.client.dateOfRequest = '8-10-2026';

    const label = (component as any).resolveRequestSubmittedDateLabel({
      dateOfRequest: '8-11-2026',
    });

    expect(label).toBe('mardi 11 août 2026');
  });

  it('uses an audit timestamp fallback when dateOfRequest is absent', () => {
    const label = (component as any).resolveRequestSubmittedDateLabel({
      requestedAt: '2026-08-11T15:30:00.000Z',
    });

    expect(label).toContain('11 août 2026');
  });

  it('returns an empty label when no valid request date exists', () => {
    component.client.dateOfRequest = 'not-a-date';
    component.client.dateJoined = 'also-not-a-date';

    const label = (component as any).resolveRequestSubmittedDateLabel();

    expect(label).toBe('');
  });
});
