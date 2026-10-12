import { PresencePerformanceComponent } from './presence-performance.component';
import { PresencePerformanceRow } from './presence-performance.util';

describe('PresencePerformanceComponent chart scale', () => {
  function chart(values: number[]): PresencePerformanceComponent {
    const component = new PresencePerformanceComponent();
    component.rows = values.map((performance, index): PresencePerformanceRow => ({
      id: String(index), name: `Employee ${index}`, role: 'Agent', location: 'Site A',
      days: 20, expected: 20, present: 20, late: 0, absent: 0, leave: 0, missing: 0, other: 0,
      attendance: 100, performance, individual: true, complete: true,
      performanceDays: 20, performanceComplete: true, missingPerformanceRecords: 0, teamKey: 'site-a',
    }));
    component.applyFilters();
    return component;
  }

  it('spreads clustered scores vertically without changing scores, attendance, or correlations', () => {
    const component = chart([20, 21, 22, 23, 25]);
    const original = component.plotted.map((point) => [point.row.id, point.row.performance, point.row.attendance]);
    const correlations = component.correlations.map((scope) => scope.result);
    const focusedGap = component.y(20) - component.y(25);
    expect(component.yMax).toBeLessThan(100);
    component.performanceScale = 'full';
    component.applyFilters();
    expect(component.yMin).toBe(0); expect(component.yMax).toBe(100);
    expect(focusedGap).toBeGreaterThan((component.y(20) - component.y(25)) * 5);
    expect(component.plotted.map((point) => [point.row.id, point.row.performance, point.row.attendance])).toEqual(original);
    expect(component.correlations.map((scope) => scope.result)).toEqual(correlations);
  });

  it('keeps negative results and results above 100 percent visible in either scale', () => {
    const component = chart([-12, 25, 135]);
    for (const mode of ['full', 'focused'] as const) {
      component.performanceScale = mode;
      component.applyFilters();
      expect(component.yMin).toBeLessThanOrEqual(-12); expect(component.yMax).toBeGreaterThanOrEqual(135);
      for (const point of component.plotted) {
        expect(point.y).toBeGreaterThanOrEqual(52); expect(point.y).toBeLessThanOrEqual(338);
      }
    }
  });

  it('uses a finite padded range for identical scores and a sensible empty range', () => {
    const component = chart([25, 25]);
    expect(component.yMax).toBeGreaterThan(component.yMin);
    expect(component.y(25)).toBeGreaterThan(52); expect(component.y(25)).toBeLessThan(338);
    component.rows = [];
    component.applyFilters();
    expect(component.yMin).toBe(0); expect(component.yMax).toBe(100); expect(component.plotted).toEqual([]);
  });

  it('resets the automatic range to the selected team while retaining a chosen employee across scale changes', () => {
    const component = chart([20, 25, 90]);
    component.rows[2].location = 'Site B';
    component.location = 'Site A';
    component.applyFilters();
    expect(component.plotted.length).toBe(2); expect(component.yMax).toBeLessThan(90);
    component.selected = component.filtered.find((row) => row.performance === 25)!;
    component.performanceScale = 'full'; component.applyFilters();
    expect(component.selected?.performance).toBe(25);
  });

  it('zooms around the selected employee and reports offscreen markers without changing results', () => {
    const component = chart([5, 20, 22.5, 25, 90]);
    component.selectEmployee(component.rows[2]);
    const scores = component.rows.map((row) => row.performance);
    const correlations = component.correlations.map((scope) => scope.result);
    const initialSpan = component.yMax - component.yMin;
    component.zoomPerformance('in'); component.zoomPerformance('in');
    expect(component.yMax - component.yMin).toBeLessThan(initialSpan);
    expect(component.isInsideZoom(22.5)).toBeTrue();
    expect(component.outsideZoomCount).toBeGreaterThan(0);
    expect(component.visiblePoints.every((point) => point.y >= 52 && point.y <= 338)).toBeTrue();
    expect(component.rows.map((row) => row.performance)).toEqual(scores);
    expect(component.correlations.map((scope) => scope.result)).toEqual(correlations);
    expect(component.plotted.length).toBe(5);
  });

  it('zooms out to the complete range and resets to automatic fit', () => {
    const component = chart([5, 22.5, 90]);
    const originalRange = [component.yMin, component.yMax];
    component.selectEmployee(component.rows[1]);
    for (let index = 0; index < 8; index++) component.zoomPerformance('in');
    expect(component.outsideZoomCount).toBe(2);
    for (let index = 0; index < 30; index++) component.zoomPerformance('out');
    expect(component.yMin).toBe(0); expect(component.yMax).toBe(100);
    expect(component.canZoomOut).toBeFalse(); expect(component.outsideZoomCount).toBe(0);
    component.resetZoom();
    expect(component.manualZoom).toBeNull();
    expect([component.yMin, component.yMax]).toEqual(originalRange);
  });

  it('pans an offscreen employee into view without losing the zoom level', () => {
    const component = chart([20, 25, 90]);
    component.selectEmployee(component.rows[1]);
    for (let index = 0; index < 5; index++) component.zoomPerformance('in');
    expect(component.isInsideZoom(90)).toBeFalse();
    const span = component.yMax - component.yMin;
    component.selectEmployee(component.rows[2]);
    expect(component.selected?.performance).toBe(90);
    expect(component.isInsideZoom(90)).toBeTrue();
    expect(component.yMax - component.yMin).toBeCloseTo(span);
  });

  it('bounds repeated zoom clicks and clears manual zoom when filters change', () => {
    const component = chart([-12, 25, 135]);
    component.selectEmployee(component.rows[1]);
    for (let index = 0; index < 40; index++) component.zoomPerformance('in');
    expect(component.yMax - component.yMin).toBeCloseTo(1);
    expect(component.canZoomIn).toBeFalse(); expect(Number.isFinite(component.y(25))).toBeTrue();
    component.applyFilters();
    expect(component.manualZoom).toBeNull(); expect(component.outsideZoomCount).toBe(0);
  });
});
