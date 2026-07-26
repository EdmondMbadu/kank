import { TrackingComponent } from './tracking.component';

describe('TrackingComponent', () => {
  it('should create', () => {
    const component = new TrackingComponent(
      {} as any,
      { currentUser: {} } as any,
      { todaysDateMonthDayYear: () => '7-25-2026' } as any,
      {} as any,
      {} as any,
      {} as any
    );

    expect(component).toBeTruthy();
  });
});
