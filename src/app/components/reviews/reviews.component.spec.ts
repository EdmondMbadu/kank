import { Employee } from 'src/app/models/employee';
import { ReviewsComponent } from './reviews.component';

describe('ReviewsComponent team performance', () => {
  let component: ReviewsComponent;
  let auth: {
    currentUser: { uid: string };
    isAdmin: boolean;
    addReview: jasmine.Spy;
  };

  beforeEach(() => {
    auth = {
      currentUser: { uid: 'site-1' },
      isAdmin: true,
      addReview: jasmine.createSpy('addReview').and.resolveTo(),
    };

    component = new ReviewsComponent(
      {} as any,
      auth as any,
      {} as any,
      {} as any,
      {
        todaysDate: () => '8-16-2026-10-00-00',
      } as any,
      {
        getGradientColor: (value: number) => `color-${value}`,
      } as any,
      { detectChanges: () => undefined } as any
    );
  });

  function setTeam(employees: Employee[]): void {
    (component as any).currentTeamEmployees = employees;
  }

  it('uses the manager team calculation for the actual calendar month', () => {
    setTeam([
      Object.assign(new Employee(), {
        role: 'Manager',
        dailyPoints: { '8-1-2026': '6' },
        totalDailyPoints: { '8-1-2026': '10' },
      }),
      Object.assign(new Employee(), {
        role: 'Agent Marketing',
        dailyPoints: { '8-1-2026': '9' },
        totalDailyPoints: { '8-1-2026': '10' },
      }),
    ]);

    (component as any).buildPerformanceGraph();

    expect(component.graphPerf.data[0].y).toEqual([75]);
    expect(component.graphPerf.data[0].x[0]).toContain('août 2026');
    expect(component.latestPerformance).toBe(75);
  });

  it('does not depend on reviews or their historical manual performance', () => {
    component.reviews = [
      {
        time: '9-1-2026-10-00-00',
        performance: 99,
      } as any,
    ];
    setTeam([
      Object.assign(new Employee(), {
        role: 'Manager',
        dailyPoints: { '9-1-2026': '4' },
        totalDailyPoints: { '9-1-2026': '10' },
      }),
    ]);

    (component as any).buildPerformanceGraph();

    expect(component.graphPerf.data[0].y).toEqual([40]);
    expect(component.latestPerformance).toBe(40);
  });

  it('limits the one-year range to the latest 12 months', () => {
    const dailyPoints: Record<string, string> = {};
    const totalDailyPoints: Record<string, string> = {};
    for (let month = 1; month <= 15; month++) {
      const year = month <= 12 ? 2025 : 2026;
      const calendarMonth = month <= 12 ? month : month - 12;
      const key = `${calendarMonth}-1-${year}`;
      dailyPoints[key] = String(month);
      totalDailyPoints[key] = '20';
    }
    setTeam([
      Object.assign(new Employee(), {
        role: 'Manager',
        dailyPoints,
        totalDailyPoints,
      }),
    ]);

    component.setPerformanceRange('1y');

    expect(component.graphPerf.data[0].x.length).toBe(12);
    expect(component.graphPerf.data[0].x[0]).toContain('avril 2025');
    expect(component.graphPerf.data[0].x[11]).toContain('mars 2026');
  });

  it('shows the complete history in the max range, including more than 12 months', () => {
    const dailyPoints: Record<string, string> = {};
    const totalDailyPoints: Record<string, string> = {};
    for (let month = 1; month <= 15; month++) {
      const year = month <= 12 ? 2025 : 2026;
      const calendarMonth = month <= 12 ? month : month - 12;
      const key = `${calendarMonth}-1-${year}`;
      dailyPoints[key] = String(month);
      totalDailyPoints[key] = '20';
    }
    setTeam([
      Object.assign(new Employee(), {
        role: 'Manager',
        dailyPoints,
        totalDailyPoints,
      }),
    ]);

    component.setPerformanceRange('max');

    expect(component.selectedRange).toBe('max');
    expect(component.graphPerf.data[0].x.length).toBe(15);
    expect(component.graphPerf.data[0].x[0]).toContain('janvier 2025');
    expect(component.graphPerf.data[0].x[14]).toContain('mars 2026');
  });

  it('uses the latest three months by default', () => {
    const dailyPoints = {
      '1-1-2026': '5',
      '2-1-2026': '6',
      '3-1-2026': '7',
      '4-1-2026': '8',
    };
    const totalDailyPoints = {
      '1-1-2026': '10',
      '2-1-2026': '10',
      '3-1-2026': '10',
      '4-1-2026': '10',
    };
    setTeam([
      Object.assign(new Employee(), {
        role: 'Manager',
        dailyPoints,
        totalDailyPoints,
      }),
    ]);

    (component as any).buildPerformanceGraph();

    expect(component.selectedRange).toBe('3m');
    expect(component.graphPerf.data[0].x.length).toBe(3);
    expect(component.graphPerf.data[0].x[0]).toContain('février 2026');
    expect(component.graphPerf.data[0].x[2]).toContain('avril 2026');
  });

  it('does not write a manual performance value into a team review', () => {
    component.allUsers = [{ uid: 'site-1', firstName: 'Mitendi' } as any];

    (component as any).submitReview('team', {
      audioUrl: '',
      targetUserId: 'site-1',
    });

    expect(auth.addReview).toHaveBeenCalled();
    const review = auth.addReview.calls.mostRecent().args[0];
    expect(review.performance).toBeUndefined();
    expect(auth.addReview.calls.mostRecent().args[1]).toBe('site-1');
  });

  it('keeps individual review performance unchanged', () => {
    component.individualPerformanceValue = 82;

    (component as any).submitReview('individual', {
      audioUrl: '',
      targetUserId: 'employee-1',
    });

    const review = auth.addReview.calls.mostRecent().args[0];
    expect(review.performance).toBe(82);
    expect(review.scope).toBe('individual');
  });
});
