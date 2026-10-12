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
  locations: string[] = [];
  roles: string[] = [];
  location = '';
  role = '';
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

  applyFilters(): void {
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
    this.yMin = Math.min(0, Math.floor(Math.min(0, ...points.map((row) => row.performance!)) / 25) * 25);
    this.yMax = Math.max(100, Math.ceil(Math.max(100, ...points.map((row) => row.performance!)) / 25) * 25);
    this.yTicks = Array.from({ length: 5 }, (_, index) => this.yMin + (this.yMax - this.yMin) * index / 4);
    this.plotted = points.map((row) => {
      const x = this.x(row.attendance!), y = this.y(row.performance!);
      return { row, x, y, color: this.color(row.location), title: this.description(row), triangle: `${x},${y - 8} ${x + 8},${y + 6} ${x - 8},${y + 6}` };
    });
    this.legend = [...new Set(points.map((row) => row.location))].map((name) => ({ name, color: this.color(name) }));
    this.trends = [];
    for (const scope of correlations) {
      if (scope.result.slope === null || scope.result.intercept === null) continue;
      // Draw only over observed X values and clip the segment to the axes.
      let min = Math.min(...scope.rows.filter((row) => row.complete).map((row) => row.attendance!));
      let max = Math.max(...scope.rows.filter((row) => row.complete).map((row) => row.attendance!));
      const slope = scope.result.slope, intercept = scope.result.intercept;
      if (Math.abs(slope) > 1e-10) {
        const boundaries = [(this.yMin - intercept) / slope, (this.yMax - intercept) / slope].sort((a, b) => a - b);
        min = Math.max(min, boundaries[0]); max = Math.min(max, boundaries[1]);
      }
      if (max >= min) this.trends.push({ label: scope.label, color: scope.color, dash: scope.dash, x1: this.x(min), y1: this.y(intercept + slope * min), x2: this.x(max), y2: this.y(intercept + slope * max) });
    }
    this.page = 0;
    this.updatePage();
  }

  changePage(delta: number): void { this.page += delta; this.updatePage(); }
  private updatePage(): void {
    this.pageCount = Math.ceil(this.filtered.length / this.pageSize);
    this.visibleRows = this.filtered.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
  }
  x(value: number): number { return 76 + value * 6.24; }
  y(value: number): number { return 338 - (value - this.yMin) * 286 / (this.yMax - this.yMin); }
  color(location: string): string { return COLORS[Math.max(0, this.locations.indexOf(location)) % COLORS.length]; }
  width(row: PresencePerformanceRow, count: number): number { return row.days ? count * 100 / row.days : 0; }
  trackRow(_index: number, row: PresencePerformanceRow): string { return row.id; }
  trackPoint(_index: number, point: { row: PresencePerformanceRow }): string { return point.row.id; }
  description(row: PresencePerformanceRow): string {
    return `${row.name} · ${row.location} · ${row.present + row.late}/${row.expected} jours de présence · Performance ${row.individual ? 'individuelle' : 'de l’équipe du site'} : ${row.performance === null ? 'indisponible' : row.performance.toFixed(1) + ' %' + (row.performanceComplete ? '' : ` (partielle : ${row.performanceDays}/${row.expected} jours, ${row.missingPerformanceRecords} attentes manquantes)`)} · ${row.missing} sans statut · ${row.other} à vérifier`;
  }
}
