import { Component } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { ActivatedRoute, Router } from '@angular/router';
import { Client, Comment } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-client-cycle',
  templateUrl: './client-cycle.component.html',
  styleUrls: ['./client-cycle.component.css'],
})
export class ClientCycleComponent {
  client = new Client();
  clientCycles: Client[] = [];
  clientCycle = new Client();
  minPay = '';
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };
  url: string = '';
  comments: Comment[] = [];

  id: any = '';
  clientId: any = '';
  cycleId: any = '';
  clientIndex: number | null = null;
  paymentDate = '';
  debtStart = '';
  debtEnd = '';
  isDebtOverdue = false;
  age: number | null = null;
  birthDateDisplay = '';
  dateJoined: string = '';
  stars: number = 0;
  isSilver: boolean = false;
  isGold: boolean = false;
  isPlatinum: boolean = false;
  showStarsExplanation = false;

  // === Performance Ring state ===
  avgPerf: number = 0; // Will mirror client.creditScore (0–100)

  size = 260; // overall SVG width/height
  strokeWidth = 16; // ring thickness
  center = this.size / 2; // center coordinate
  radius2 = this.center - this.strokeWidth / 2; // inner radius

  gradId = `gradPerfRing-${Math.random().toString(36).slice(2)}`;
  ticks: number[] = Array.from({ length: 10 }, (_, i) => i * 36); // every 10%

  // Label (month/year)
  currentMonth = new Date().getMonth(); // 0-based
  currentYear = new Date().getFullYear();
  monthFrenchNames = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ];

  // Compute dasharray for progress arc
  progressDasharray(): string {
    const c = 2 * Math.PI * this.radius2;
    const pct = Math.max(0, Math.min(1, (this.avgPerf || 0) / 100));
    const filled = c * pct;
    const rest = c - filled;
    return `${filled} ${rest}`;
  }

  // Simple color ramp (works well for stroke)
  colorForPerf(v: number): string {
    const clamped = Math.max(0, Math.min(100, v ?? 0));
    return this.compute.getGradientColor(clamped);
  }

  private formatBirthDate(birth?: string | null): string {
    if (!birth) {
      return '';
    }
    const parts = birth.split('-');
    if (parts.length !== 3) {
      return birth;
    }
    const [dayStr, monthStr, yearStr] = parts;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    if (
      !Number.isFinite(day) ||
      !Number.isFinite(month) ||
      !Number.isFinite(year)
    ) {
      return birth;
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return birth;
    }
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  determineTrophy() {
    const score = Number.isFinite(this.avgPerf) ? this.avgPerf : 0;
    this.isSilver = score >= 70 && score <= 99;
    this.isGold = score >= 100;
    this.isPlatinum = false;
  }
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private compute: ComputationService,
    private storage: AngularFireStorage
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    const [ci, cy] = this.id.split('-');
    this.clientId = ci;
    this.cycleId = cy;
    this.findClientIndex();
  }

  findClientIndex(): void {
    this.auth.getAllClients().subscribe((clients: any) => {
      if (Array.isArray(clients)) {
        const index = clients.findIndex((c: Client) => c.uid === this.clientId);
        if (index !== -1) {
          this.clientIndex = index;
        }
      }
    });
  }
  ngOnInit(): void {
    this.retrieveClientCycle();
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.findAgent();
    });
  }
  findAgent() {
    for (let em of this.employees) {
      if (this.client.agent !== undefined && this.client.agent === em.uid) {
        this.agent = em;
      }
    }
  }

  retrieveClientCycle(): void {
    this.auth.getClient(this.clientId).subscribe((data: any) => {
      this.clientCycle = data;
      this.data
        .getClientCycle(this.clientId, this.cycleId)
        .subscribe((dataC) => {
          this.client = dataC;

          this.age = this.compute.computeAge(this.client.birthDate);
          this.birthDateDisplay = this.formatBirthDate(this.client.birthDate);

          this.minimumPayment();
          this.client.frenchPaymentDay = this.time.translateDayInFrench(
            this.client.paymentDay!
          );
          this.setComments();
          this.setGraphCredit();

          this.paymentDate = this.time.nextPaymentDate(this.client.dateJoined);
          this.debtStart = this.time.formatDateString(
            this.client.debtCycleStartDate
          );
          this.debtEnd = this.time.formatDateString(this.endDate());
          this.isDebtOverdue = this.checkDebtOverdue();

          if (this.client.dateJoined) {
            this.dateJoined = this.time.formatDateForDRC(this.client.dateJoined);
          }
          
          if (this.client.stars) {
            this.stars = Number(this.client.stars);
          } else {
            this.stars = 0;
          }

          this.retrieveEmployees();
        });
    });
  }

  setGraphCredit() {
    const raw = Number(this.client?.creditScore);
    const val = Number.isFinite(raw) ? raw : 0;
    this.avgPerf = Math.max(0, Math.min(100, val));
    this.determineTrophy();
  }

  endDate() {
    return Number(this.client.paymentPeriodRange) === 8
      ? this.time.getDateInNineWeeks(this.client.debtCycleStartDate!)
      : this.time.getDateInFiveWeeks(this.client.debtCycleStartDate!);
  }

  private checkDebtOverdue(): boolean {
    if (Number(this.client.debtLeft) <= 0) return false;
    const end = this.endDate();
    if (!end) return false;
    const parts = end.split('-');
    const endDate = new Date(+parts[2], +parts[0] - 1, +parts[1]);
    return new Date() > endDate;
  }

  minimumPayment() {
    const pay =
      Number(this.client.amountToPay) / Number(this.client.paymentPeriodRange);
    this.minPay = pay.toString();
  }

  setComments() {
    if (this.client.comments) {
      this.comments = this.client.comments;
      console.log(' comments ', this.comments);
      // add the formatted time
      this.comments.forEach((comment) => {
        comment.timeFormatted = this.time.convertDateToDesiredFormat(
          comment.time!
        );
      });
    }
    this.comments.sort((a: any, b: any) => {
      const parseTime = (time: string) => {
        const [month, day, year, hour, minute, second] = time
          .split('-')
          .map(Number);
        return new Date(year, month - 1, day, hour, minute, second).getTime();
      };

      const dateA = parseTime(a.time);
      const dateB = parseTime(b.time);
      return dateB - dateA; // Descending order
    });
  }
}
