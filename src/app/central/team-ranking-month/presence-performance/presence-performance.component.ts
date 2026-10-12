import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { buildPresencePerformanceRows, presenceCorrelationsByScope, PresenceCorrelation, PresencePerformanceRow, PresencePerformanceSource } from './presence-performance.util';

const COLORS = ['#047857', '#2563eb', '#9333ea', '#c2410c', '#0891b2', '#be185d', '#4f46e5', '#64748b'];

@Component({
  selector: 'app-presence-performance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './presence-performance.component.html',
  styleUrls: ['./presence-performance.component.css'],
})
export class PresencePerformanceComponent implements OnChanges {
  @Input() source!: PresencePerformanceSource;
  rows: PresencePerformanceRow[] = [];
  filtered: PresencePerformanceRow[] = [];
  plotted: Array<{ row: PresencePerformanceRow; x: number; y: number; color: string; title: string; triangle: string }> = [];
  visiblePoints: PresencePerformanceComponent['plotted'] = [];
  outsideZoomCount = 0;
  manualZoom: { min: number; max: number } | null = null;
  private fullMin = 0;
  private fullMax = 100;
  locations: string[] = [];
  roles: string[] = [];
  location = '';
  role = '';
  performanceScale: 'focused' | 'full' = 'focused';
  selected: PresencePerformanceRow | null = null;
  correlations: Array<{ label: string; result: PresenceCorrelation; message: string }> = [];
  yMin = 0;
  yMax = 100;
  yTicks: number[] = [];
  xTicks = [0, 25, 50, 75, 100];
  page = 0;
  pageSize = 15;
  visibleRows: PresencePerformanceRow[] = [];
  pageCount = 0;
  completeCount = 0;
  unavailableCount = 0;
  unavailableRows: PresencePerformanceRow[] = [];
  partialPerformanceCount = 0;
  meanAttendance: number | null = null;
  trends: Array<{ label: string; color: string; dash: string; x1: number; y1: number; x2: number; y2: number }> = [];
  legend: Array<{ name: string; color: string }> = [];

  ngOnChanges(): void {
    this.rows = buildPresencePerformanceRows(this.source);
    this.locations = [...new Set(this.rows.map((row) => row.location))].sort();
    this.roles = [...new Set(this.rows.map((row) => row.role))].sort();
    if (!this.locations.includes(this.location)) this.location = '';
    if (!this.roles.includes(this.role)) this.role = '';
    this.applyFilters();
  }

  applyFilters(preserveZoom = false): void {
    if (!preserveZoom) this.manualZoom = null;
    this.filtered = this.rows.filter((row) => (!this.location || row.location === this.location) && (!this.role || row.role === this.role))
      .sort((a, b) => (b.attendance ?? -1) - (a.attendance ?? -1) || a.name.localeCompare(b.name));
    const previousId = this.selected?.id;
    this.selected = this.filtered.find((row) => row.id === previousId) || this.filtered.find((row) => row.performance !== null) || this.filtered[0] || null;
    const scopes = presenceCorrelationsByScope(this.filtered);
    const correlations = [
      { label: 'Employés · performance individuelle', result: scopes.individual, rows: scopes.individualRows, color: '#334155', dash: '6 5' },
      { label: 'Managers · performance de leur site', result: scopes.team, rows: scopes.teamRows, color: '#7c3aed', dash: '2 4' },
    ];
    this.correlations = correlations.map(({ label, result }) => ({ label, result, message: result.n < 5
      ? `Au moins 5 dossiers complets sont nécessaires (${result.n} disponibles).`
      : 'Taux de présence ou performances identiques : la corrélation ne peut pas être calculée.' }));
    this.completeCount = this.filtered.filter((row) => row.complete).length;
    this.unavailableRows = this.filtered.filter((row) => row.performance === null || row.attendance === null);
    this.unavailableCount = this.unavailableRows.length;
    this.partialPerformanceCount = this.filtered.filter((row) => row.performance !== null && !row.performanceComplete).length;
    const known = this.filtered.filter((row) => row.expected > 0 && row.missing === 0 && row.other === 0);
    const expected = known.reduce((sum, row) => sum + row.expected, 0);
    this.meanAttendance = expected ? known.reduce((sum, row) => sum + row.present + row.late, 0) * 100 / expected : null;
    const points = this.filtered.filter((row) => row.performance !== null && row.attendance !== null);
    this.setPerformanceScale(points.map((row) => row.performance!));
    if (this.manualZoom) {
      this.yMin = this.manualZoom.min;
      this.yMax = this.manualZoom.max;
      this.yTicks = Array.from({ length: 5 }, (_, index) => this.yMin + (this.yMax - this.yMin) * index / 4);
    }
    this.plotted = points.map((row) => {
      const x = this.x(row.attendance!), y = this.y(row.performance!);
      return { row, x, y, color: this.color(row.location), title: this.description(row), triangle: `${x},${y - 8} ${x + 8},${y + 6} ${x - 8},${y + 6}` };
    });
    this.visiblePoints = this.plotted.filter((point) => this.isInsideZoom(point.row.performance!));
    this.outsideZoomCount = this.plotted.length - this.visiblePoints.length;
    this.legend = [...new Set(points.map((row) => row.location))].map((name) => ({ name, color: this.color(name) }));
    this.trends = [];
    for (const scope of correlations) {
      if (scope.result.slope === null || scope.result.intercept === null) continue;
      // Draw only over observed X values and clip the segment to the axes.
      let min = Math.min(...scope.rows.filter((row) => row.complete).map((row) => row.attendance!));
      let max = Math.max(...scope.rows.filter((row) => row.complete).map((row) => row.attendance!));
      const slope = scope.result.slope, intercept = scope.result.intercept;
      if (Math.abs(slope) <= 1e-10 && !this.isInsideZoom(intercept)) continue;
      if (Math.abs(slope) > 1e-10) {
        const boundaries = [(this.yMin - intercept) / slope, (this.yMax - intercept) / slope].sort((a, b) => a - b);
        min = Math.max(min, boundaries[0]); max = Math.min(max, boundaries[1]);
      }
      if (max >= min) this.trends.push({ label: scope.label, color: scope.color, dash: scope.dash, x1: this.x(min), y1: this.y(intercept + slope * min), x2: this.x(max), y2: this.y(intercept + slope * max) });
    }
    if (!preserveZoom) this.page = 0;
    this.updatePage();
  }

  private setPerformanceScale(values: number[]): void {
    this.fullMin = Math.min(0, Math.floor(Math.min(0, ...values) / 25) * 25);
    this.fullMax = Math.max(100, Math.ceil(Math.max(100, ...values) / 25) * 25);
    if (!values.length || this.performanceScale === 'full') {
      this.yMin = this.fullMin;
      this.yMax = this.fullMax;
      this.yTicks = Array.from({ length: 5 }, (_, index) => this.yMin + (this.yMax - this.yMin) * index / 4);
      return;
    }
    const min = Math.min(...values), max = Math.max(...values);
    const padding = Math.max(1, (max - min) * 0.1);
    const lower = min >= 0 ? Math.max(0, min - padding) : min - padding;
    const upper = max + padding;
    const roughStep = (upper - lower) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const step = Math.max(1, [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= roughStep)! * magnitude);
    this.yMin = Math.floor(lower / step) * step;
    this.yMax = Math.ceil(upper / step) * step;
    this.yTicks = Array.from({ length: Math.round((this.yMax - this.yMin) / step) + 1 }, (_, index) => this.yMin + index * step);
  }

  get canZoomIn(): boolean { return this.plotted.length > 0 && this.yMax - this.yMin > 1.000001; }
  get canZoomOut(): boolean { return this.plotted.length > 0 && (this.yMin > this.fullMin + 0.000001 || this.yMax < this.fullMax - 0.000001); }

  zoomPerformance(direction: 'in' | 'out'): void {
    if (direction === 'in' ? !this.canZoomIn : !this.canZoomOut) return;
    const center = this.selected?.performance ?? (this.yMin + this.yMax) / 2;
    const span = (this.yMax - this.yMin) * (direction === 'in' ? 0.65 : 1 / 0.65);
    this.manualZoom = this.zoomBounds(center, span);
    this.applyFilters(true);
  }

  resetZoom(): void { this.applyFilters(); }

  selectEmployee(row: PresencePerformanceRow): void {
    this.selected = row;
    if (this.manualZoom && row.performance !== null && !this.isInsideZoom(row.performance)) {
      this.manualZoom = this.zoomBounds(row.performance, this.yMax - this.yMin);
      this.applyFilters(true);
    }
  }

  isInsideZoom(value: number): boolean { return value >= this.yMin - 1e-9 && value <= this.yMax + 1e-9; }

  private zoomBounds(center: number, requestedSpan: number): { min: number; max: number } {
    // Snap the endpoint so repeated inverse zooms cannot leave 100% just
    // outside the axis through floating-point rounding.
    if (requestedSpan >= this.fullMax - this.fullMin - 1e-6) return { min: this.fullMin, max: this.fullMax };
    const span = Math.min(this.fullMax - this.fullMin, Math.max(1, requestedSpan));
    const min = Math.max(this.fullMin, Math.min(center - span / 2, this.fullMax - span));
    return { min, max: min + span };
  }

  changePage(delta: number): void { this.page += delta; this.updatePage(); }
  private updatePage(): void {
    this.pageCount = Math.ceil(this.filtered.length / this.pageSize);
    this.visibleRows = this.filtered.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
  }
  x(value: number): number { return 100 + value * 6; }
  y(value: number): number { return 338 - (value - this.yMin) * 286 / (this.yMax - this.yMin); }
  color(location: string): string { return COLORS[Math.max(0, this.locations.indexOf(location)) % COLORS.length]; }
  width(row: PresencePerformanceRow, count: number): number { return row.days ? count * 100 / row.days : 0; }
  trackRow(_index: number, row: PresencePerformanceRow): string { return row.id; }
  trackPoint(_index: number, point: { row: PresencePerformanceRow }): string { return point.row.id; }
  description(row: PresencePerformanceRow): string {
    return `${row.name} · ${row.location} · ${row.present + row.late}/${row.expected} jours de présence · Performance ${row.individual ? 'individuelle' : 'de l’équipe du site'} : ${row.performance === null ? 'indisponible' : row.performance.toFixed(1) + ' %' + (row.performanceComplete ? '' : ` (partielle : ${row.performanceDays}/${row.expected} jours, ${row.missingPerformanceRecords} attentes manquantes)`)} · ${row.missing} sans statut · ${row.other} à vérifier`;
  }
}
