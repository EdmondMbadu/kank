import {
  Component,
  computed,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Employee,
  Trophy,
  WeeklyObjectiveDeduction,
} from 'src/app/models/employee';
import { Comment } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

import { DataService } from 'src/app/services/data.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { LocationCoordinates } from 'src/app/models/user';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom, Subscription } from 'rxjs';
import firebase from 'firebase/compat/app';

// at the top, with other imports
import exifr from 'exifr'; // if TS complains, use: import * as exifr from 'exifr';

import { faL } from '@fortawesome/free-solid-svg-icons';
// import heic2any from 'heic2any';
/* ─── Audit-receipt model ───────────────────────── */
interface AuditReceipt {
  docId: string;
  url: string;
  ts: number;
  frenchDate: string;
  amount?: number;
}

type AttendanceStateCode = '' | 'P' | 'A' | 'L' | 'V' | 'VP' | 'N';

type PickerStateOption = {
  code: AttendanceStateCode;
  label: string;
  hint?: string;
};

type PerformanceRangeKey = '3M' | '6M' | '9M' | '1A' | 'MAX';

type PerformanceBarTrace = {
  x: string[];
  y: number[];
  type: 'bar';
  marker: {
    color: string | string[];
    line?: {
      color: string | string[];
      width?: number;
    };
  };
};

type PerformanceGraph = {
  data: PerformanceBarTrace[];
  layout: any;
};

type ContractSection = {
  title: string;
  bullets?: string[];
  paragraphs?: string[];
};

type ContractViewModel = {
  title: string;
  subject: string;
  intro: string[];
  sections: ContractSection[];
  closing: string[];
  signedDate: string;
  signedDateShort: string;
  roleLabel: 'Manager' | 'Agent Marketing' | 'Manager Regionale' | 'Auditrice';
  effectiveDate?: string;
  signatureDataUrl?: string;
};

@Component({
  selector: 'app-employee-page',
  templateUrl: './employee-page.component.html',
  styleUrls: ['./employee-page.component.css'],
})
export class EmployeePageComponent implements OnInit, OnDestroy {
  private readonly baseSalaryLabel = 'Base mensuelle';
  // ── Attendance state picker (admin) ─────────────────────────────
  showStatePickerModal = false;
  public statePickerKey = ''; // key we will edit (e.g. "8-23-2025" or "8-23-2025-09-15-02")
  public statePickerCurr: string | undefined; // current state at that key, if any
  selectedState: AttendanceStateCode = '';
  statePickerMode: 'admin' | 'employee' = 'admin';

  viewAsMode: 'admin' | 'employee' = this.auth.isAdmninistrator
    ? 'admin'
    : 'employee';

  showCollectionsEditor = false;
  editorDayKey = '';
  editorExpected = ''; // string so empty means "clear"
  editorTotal = '';
  editorBusy = false;
  editorErr = '';

  pickerStates: PickerStateOption[] = [
    { code: '', label: '— Aucun', hint: 'Effacer la valeur' },
    { code: 'P', label: 'Présent' },
    { code: 'A', label: 'Absent' },
    { code: 'L', label: 'Retard' },
    { code: 'V', label: 'Vacances' },
    { code: 'VP', label: 'Vacances en cours' },
    { code: 'N', label: 'Néant' },
  ];
  employeePickerStates: PickerStateOption[] = [
    {
      code: 'V',
      label: 'Vacances',
      hint: 'Cette journée sera marquée comme vacances.',
    },
  ];
  activePickerStates: PickerStateOption[] = this.pickerStates;

  get isAdminUi(): boolean {
    return this.auth.isAdmninistrator && this.viewAsMode === 'admin';
  }

  get isEmployeeUi(): boolean {
    return !this.auth.isAdmninistrator || this.viewAsMode === 'employee';
  }

  setViewAsMode(mode: 'admin' | 'employee') {
    if (!this.auth.isAdmninistrator) {
      return;
    }
    this.viewAsMode = mode;
  }

  // ── Commentaires individuels ───────────────────────
  individualReviews: Comment[] = [];
  private individualReviewsSub?: Subscription;
  individualReviewsLoading = false;
  individualReviewDocId: string | null = null;
  readonly individualMetricDefinitions: Array<{
    key: string;
    label: string;
    measure: string;
    criteria: string;
  }> = [
    {
      key: 'ponctualite',
      label: 'Ponctualité & Présence',
      measure: 'Respect du temps de travail',
      criteria: 'Arrivée à l’heure, pauses raisonnables, disponibilité',
    },
    {
      key: 'proprete',
      label: 'Respect des Procédures & Traçabilité (e.g commentaires, etc)',
      measure: 'Professionnalisme dans la présentation et l’ordre',
      criteria: 'Uniforme propre, bureau propre, cahiers/carnets bien tenus',
    },
    {
      key: 'suiviClients',
      label: 'Suivi des Clients (Rappel & Visites)',
      measure: 'Engagement dans le suivi de portefeuille',
      criteria:
        'Appels réguliers, visites des absents, suivi des cas compliqués',
    },
    {
      key: 'relationClient',
      label: 'Qualité de l’Interaction Client',
      measure: 'Respect, écoute, transparence',
      criteria: 'Ton utilisé, patience, capacité à expliquer clairement',
    },
    {
      key: 'attitudeEquipe',
      label: 'Attitude & Esprit d’Équipe',
      measure: 'Collaboration et contribution au bon climat interne',
      criteria: 'Respect des collègues, initiative, volonté d’aider',
    },
  ];
  readonly individualMetricKeys = this.individualMetricDefinitions.map(
    ({ key, label }) => ({ key, label })
  );

  /** dayKey "M-D-YYYY" -> { expected, total } */
  monthlyDayTotals: Record<string, { expected: number; total: number }> = {};

  public friendlyFromKey(key: string): string {
    // key examples: "8-23-2025" or "8-23-2025-09-15-02" → show DD/MM/YYYY
    const [m, d, y] = key
      .split('-')
      .slice(0, 3)
      .map((n) => parseInt(n, 10));
    if (!m || !d || !y) return key;
    return `${d}/${m}/${y}`;
  }

  attachmentViewer = {
    open: false,
    url: '',
    kind: '' as 'image' | 'video',
    dateLabel: '',
    takenAt: null as Date | null,
    takenAtSource: '' as
      | 'exif'
      | 'fileLastModified'
      | 'storageUploadedAt'
      | 'unknown'
      | '',
    deviceLabel: '', // 👈 NEW
    photoHash: '' as string | undefined, // 👈 NEW
  };
  // state
  savingAttendance = false;

  // tiny sleep for UI smoothing (optional)
  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // Map: 'M-D-YYYY' -> array of attachments for that day
  monthAttachmentsByLabel: Record<string, any[]> = {};

  // ── États UI pour le marquage automatique de présence ──
  isMarkingPresence = false;
  presenceStatus:
    | 'idle'
    | 'locating'
    | 'checking'
    | 'saving'
    | 'done'
    | 'error' = 'idle';
  warmingUp = false;

  lastAccuracy?: number;
  lastDistance?: number;
  lastFixAt?: Date;
  // Cutoff for "on time"
  // limitHour = 9;
  // limitMinutes = 5; // 09:05
  /** Ordre de rotation des statuts */
  private readonly ATT_STATES = ['P', 'A', 'L', 'V', 'VP', 'N'];

  geoStatus: 'granted' | 'prompt' | 'denied' | 'unknown' = 'unknown';

  salaryPaid: string = '';
  showRequestVacation: boolean = false;
  readonly TOTAL_VACATION_DAYS = 7;

  /* ─── Component state ───────────────────────────── */
  auditReceipts: AuditReceipt[] = [];
  auditSearch = '';
  auditNewAmount: number | null = null;
  private auditSel = '';
  showAllAuditReceipts = false; // For admin to expand and see all receipts
  showAllPayments = false; // For admin to expand and see all payments
  @ViewChild('auditFileInput') auditFileInput!: ElementRef<HTMLInputElement>;

  requestDate: string = '';

  isLoading: boolean = false;
  vacation: number = 0;
  currentDownloadUrl: string = '';
  displayMakePayment: boolean = false;
  displayAttendance: boolean = false;
  attendance: string = '';
  attendanceMode: 'today' | 'yesterday' = 'today';

  // ===== Trophy Modal state =====
  trophyModalVisible = false;
  trophyModalType: 'team' | 'employee' | null = null;
  attendanceTargetDate: Date = new Date();
  // today = this.time.todaysDateMonthDayYear();

  limitHour: number = 9;
  limitMinutes: number = 5;
  onTime: string = '';

  locationCoordinate: LocationCoordinates = {};
  // For tracking which payment index we're attaching a receipt for
  currentReceiptIndex: number | null = null;

  withinRadius: boolean | null = null;
  errorMessage: string | null = null;
  locationSet: boolean = false;

  currentLat: number = 0;
  currentLng: number = 0;
  radius = 1200; //Set your desired radius in meters.

  displayBonus: boolean = false;
  displayPayment: boolean = false;
  displayCode: boolean = false;
  displaySetCode: boolean = false;
  displayContract: boolean = false;
  contractView?: ContractViewModel;
  @ViewChild('signaturePad') signaturePad!: ElementRef<HTMLCanvasElement>;
  isDrawingSignature = false;
  signatureDataUrl: string = '';
  private signatureContext?: CanvasRenderingContext2D | null;
  contractSignVisible: string = 'false';
  contractSignedAt: string = '';
  contractSignedDateOnly: string = '';
  contractSignatureName: string = '';
  contractSignatureImage: string | null = null;
  code: string = '';

  attendanceComplete: boolean = true;
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  lastMonth: number = this.currentMonth - 1;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  contractYear: number = this.year;
  givenYear = this.year;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  day = this.currentDate.getDate();
  yearsList: number[] = this.time.yearsList;
  j: number = 1;
  monthYear = `${this.month} ${this.year}`;
  id: any = '';
  invoiceNum: string = '';
  employees: Employee[] = [];
  employee: Employee = {};
  averageToday: string = '';
  totalPointsMonth: string = '';
  paymentAmounts: string[] = [];
  paymentDates: string[] = [];

  paymentNothing: number = 0;
  paymentAbsent: number = 0;
  totalPayments: number = 0;
  paymentIncreaseYears: number = 0;
  paymentBankFee: number = 0;
  paymentLate: number = 0;
  paymentObjectiveWeekDeductionTotal: number = 0;
  paymentObjectiveWeekDeductions: WeeklyObjectiveDeduction[] = [];
  weekObjectiveStartDate: string = '';
  weekObjectiveEndDate: string = '';
  weekObjectiveEndLabel: string = '';
  weekObjectiveAmount: number = 5;

  averagePointsMonth: string = '';
  performancePercentageMonth: string = '';
  performancePercentageTotal: string = '';
  totalToday: string = '';
  today: string = this.time.todaysDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  recentPerformanceDates: string[] = [];
  recentPerformanceNumbers: number[] = [];
  performanceActiveRange: PerformanceRangeKey = '3M';
  private readonly performanceRangeMap: Record<PerformanceRangeKey, number> = {
    '3M': 3,
    '6M': 6,
    '9M': 9,
    '1A': 12,
    MAX: 0,
  };
  performanceMaxRange = 0;
  private performanceGraphLabels: string[] = [];
  private performanceGraphValues: number[] = [];
  maxRange: number = 0;
  bonusPercentage: number = 0;
  checkVisible: string = 'false';
  paymentCheckVisible: string = 'false';
  bonusMonth: number = 0;
  bonusAmount: number = 0;
  bestTeamBonusAmount: number = 0;
  bestEmployeeBonusAmount: number = 0;
  bestManagerBonusAmount: number = 0;
  thisMonthPaymentAmount: number = 0;
  totalBonusAmount: number = 0;
  paymentCode: string = '';

  paymentAmount: number = 0;
  preposition: string = '';

  totalPoints: string = '';
  baseSalary: string = '';
  averagePoints: string = '';
  totalBonusSalary: string = '';
  salaryThisMonth = '';
  yearsAtCompany: number = 0;

  /* employee-page.component.ts */
  isAuthorized = false; // page visible only when TRUE
  errorMsg = ''; // “code incorrect” feedback
  paymentCodeLoaded = false; // becomes true once we have the employee object
  private employeesSub?: Subscription;
  constructor(
    private router: Router,
    private data: DataService,
    public auth: AuthService,
    public time: TimeService,
    public compute: ComputationService,
    private performance: PerformanceService,
    public activatedRoute: ActivatedRoute,
    private storage: AngularFireStorage,
    private fns: AngularFireFunctions,
    private afs: AngularFirestore
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveEmployees();
    if (this.auth.isAdmninistrator) this.isAuthorized = true;
    this.attendanceTargetDate = this.resolveAttendanceTargetDate('today');
  }
  ngOnDestroy(): void {
    this.employeesSub?.unsubscribe();
    this.individualReviewsSub?.unsubscribe();
  }
  public graphPerformance: PerformanceGraph =
    this.createEmptyPerformanceGraph();
  /* ─── Fetch on init ─────────────────────────────── */
  private loadAuditReceipts() {
    // Always load 50 for admin (they can expand to see all), 2 for non-admin
    const limit = this.auth.isAdmin ? 50 : 2;
    this.afs
      .collection(`users/${this.employee.uid}/auditReceipts`, (ref) =>
        ref.orderBy('ts', 'desc').limit(limit)
      )
      .snapshotChanges()
      .subscribe((snaps) => {
        this.auditReceipts = snaps.map((s) => {
          const d = s.payload.doc.data() as any;
          return {
            docId: s.payload.doc.id,
            url: d.url,
            ts: d.ts,
            frenchDate: this.time.formatEpochLongFr(d.ts),
            amount: d.amount ?? 0,
          };
        });
      });
  }
  private loadIndividualReviews(targetUid?: string | null): void {
    this.individualReviewsSub?.unsubscribe();
    this.individualReviewsSub = undefined;
    this.individualReviews = [];
    this.individualReviewDocId = null;

    if (!targetUid) {
      this.individualReviewsLoading = false;
      return;
    }

    this.individualReviewsLoading = true;
    this.individualReviewsSub = this.auth
      .getReviewsForTarget(targetUid)
      .subscribe({
        next: (result) => {
          const reviewDocId = result?.reviewDocId ?? null;
          const reviews = result?.reviews ?? [];
          this.individualReviewDocId = reviewDocId;

          const scoped = reviews.filter(
            (review) => review && review.scope === 'individual'
          );

          const processed = scoped.map((review) => {
            const normalized: Comment = { ...review };
            normalized.starsNumber = Number(review.stars ?? 0);
            normalized.timeFormatted = review.time
              ? this.time.convertDateToDesiredFormat(review.time)
              : '';
            (normalized as any).__editing = false;
            (normalized as any).__draftComment = normalized.comment ?? '';
            (normalized as any).__draftPerformance =
              normalized.performance ?? 0;
            (normalized as any).__saving = false;
            return normalized;
          });

          processed.sort((a, b) => {
            const parse = (value?: string) => {
              if (!value) return 0;
              const parts = value.split('-').map(Number);
              if (parts.length < 6) return 0;
              const [month, day, year, hour, minute, second] = parts;
              return new Date(
                year,
                (month || 1) - 1,
                day || 1,
                hour || 0,
                minute || 0,
                second || 0
              ).getTime();
            };
            return parse(b.time) - parse(a.time);
          });

          this.individualReviews = processed;
          this.individualReviewsLoading = false;
        },
        error: (err) => {
          console.error('Failed to load individual reviews:', err);
          this.individualReviews = [];
          this.individualReviewDocId = null;
          this.individualReviewsLoading = false;
        },
      });
  }
  public graphMonthPerformance = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };

  /** Met à jour this.vacation (= jours restants) */
  findNumberOfVacationDaysLeft() {
    const acceptedDays =
      Number(this.employee.vacationAcceptedNumberOfDays) || 0;
    this.vacation = this.TOTAL_VACATION_DAYS - acceptedDays;
  }

  get perfColor(): string {
    const n = Number(this.performancePercentageMonth) || 0;
    return this.compute.getGradientColor(n); // e.g. "rgb(255, 0, 0)"
  }

  get perfBg(): string {
    // light tint for the chip background
    return this.perfColor.replace('rgb(', 'rgba(').replace(')', ',0.12)');
  }

  get individualReviewsForDisplay(): Comment[] {
    return this.auth.isAdmin
      ? this.individualReviews
      : this.individualReviews.filter((review) => review.visible);
  }

  getIndividualMetricLabel(key: string): string {
    return (
      this.individualMetricDefinitions.find((def) => def.key === key)?.label ||
      key
    );
  }

  getIndividualMetricDefinition(key: string) {
    return this.individualMetricDefinitions.find((def) => def.key === key);
  }

  private sanitizeReviewForPersistence(review: Comment): Comment {
    const {
      timeFormatted,
      starsNumber,
      __editingPerf,
      __perfDraft,
      __editingComment,
      __commentDraft,
      __editing,
      __draftComment,
      __draftPerformance,
      __saving,
      ...rest
    } = review as any;
    return { ...(rest as Comment) };
  }

  onToggleIndividualReviewVisibility(review: Comment, visible: boolean): void {
    if (
      !this.auth.isAdmin ||
      !this.individualReviewDocId ||
      !this.employee?.uid
    ) {
      return;
    }

    const previous = review.visible ?? false;
    review.visible = visible;
    const payload = this.sanitizeReviewForPersistence(review);

    this.auth
      .updateReviewVisibility(
        this.individualReviewDocId,
        payload,
        this.employee.uid
      )
      .catch((error) => {
        console.error('Failed to update review visibility:', error);
        review.visible = previous;
        alert(
          'Impossible de mettre à jour la visibilité du commentaire. Veuillez réessayer.'
        );
      });
  }

  onDeleteIndividualReview(review: Comment): void {
    if (
      !this.auth.isAdmin ||
      !this.individualReviewDocId ||
      !this.employee?.uid
    ) {
      return;
    }
    if (!confirm('Supprimer définitivement ce commentaire ?')) {
      return;
    }

    const payload = this.sanitizeReviewForPersistence(review);
    this.auth
      .deleteReview(this.individualReviewDocId, payload, this.employee.uid)
      .catch((error) => {
        console.error('Failed to delete review:', error);
        alert(
          'Impossible de supprimer ce commentaire. Veuillez réessayer dans un instant.'
        );
      });
  }

  onStartEditIndividualReview(review: any): void {
    if (!this.auth.isAdmin) {
      return;
    }
    review.__editing = true;
    review.__draftComment = review.comment ?? '';
    review.__draftPerformance = review.performance ?? 0;
  }

  onCancelEditIndividualReview(review: any): void {
    review.__editing = false;
    review.__draftComment = review.comment ?? '';
    review.__draftPerformance = review.performance ?? 0;
  }

  onSaveIndividualReview(review: any): void {
    if (
      !this.auth.isAdmin ||
      !this.individualReviewDocId ||
      !this.employee?.uid
    ) {
      return;
    }

    const sanitizedDraftComment = (review.__draftComment || '').trim();
    const draftPerformance = Number(review.__draftPerformance ?? 0);

    const previousComment = review.comment ?? '';
    const previousPerformance = review.performance ?? 0;

    review.comment = sanitizedDraftComment;
    review.performance = isNaN(draftPerformance) ? 0 : draftPerformance;
    review.__saving = true;

    const cleaned = this.individualReviews.map((rev) =>
      this.sanitizeReviewForPersistence(rev)
    );

    this.auth
      .updateReview(this.individualReviewDocId, cleaned, this.employee.uid)
      .then(() => {
        review.__editing = false;
        review.__saving = false;
      })
      .catch((error) => {
        console.error('Failed to update review:', error);
        review.comment = previousComment;
        review.performance = previousPerformance;
        review.__saving = false;
        alert(
          "Impossible d'enregistrer les modifications. Veuillez réessayer."
        );
      });
  }

  toggle(property: 'showRequestVacation' | 'isLoading') {
    this[property] = !this[property];
  }
  toggleBonus() {
    this.displayBonus = !this.displayBonus;
  }
  togglePayment() {
    this.displayPayment = !this.displayPayment;
  }
  toggleCode() {
    this.displayCode = !this.displayCode;
  }
  toggleSetCode() {
    this.displaySetCode = !this.displaySetCode;
  }
  private buildEmployeeName(target: Employee = this.employee): string {
    return [
      target?.firstName ?? '',
      target?.middleName ?? '',
      target?.lastName ?? '',
    ]
      .map((p) => p.toString().trim())
      .filter((p) => p)
      .join(' ')
      .trim();
  }

  private theftRules(): string[] {
    return [
      "Cas de Vol — Demander plus d'argent que ce qui est requis au client : Exemple : faire payer des frais d’adhésion ou d’épargne supérieurs aux montants officiels.",
      'Cas de Vol — Donner moins d’argent au client que ce qui est déclaré : Le montant donné au client doit toujours correspondre à ce qui est inscrit dans le système.',
      "Cas de Vol — Garder l'argent du client plus d'une journée : Aucun prétexte (oubli, système, budget à venir) ne justifie de garder l'argent du client. Il doit être entré dans le système le jour même.",
      'Cas de Vol — Créer de faux clients avec de fausses identités : Numéros de téléphone ou photos inventés = vol. Tolérance zéro.',
      "Cas de Vol — Prêter de l'argent à un membre de la famille ou un ami : Tout prêt doit respecter les règles sans conflit d’intérêt personnel.",
      'Cas de Vol — Prétendre être présent sur le lieu de travail alors que vous êtes absent : Se faire passer pour actif alors qu’on est en déplacement ou ailleurs est considéré comme une tentative de fraude.',
      '🚨 Toute violation de ces règles est considérée comme un vol et peut entraîner des sanctions disciplinaires, des poursuites judiciaires et une peine de prison.',
    ];
  }

  setEmployeeBonusAmounts() {
    this.bonusPercentage = this.employee.bonusPercentage
      ? parseFloat(this.employee.bonusPercentage)
      : 0;
    this.bonusAmount = this.employee.bonusAmount
      ? parseFloat(this.employee.bonusAmount)
      : 0;
    this.bestTeamBonusAmount = this.employee.bestTeamBonusAmount
      ? parseFloat(this.employee.bestTeamBonusAmount)
      : 0;
    this.bestEmployeeBonusAmount = this.employee.bestEmployeeBonusAmount
      ? parseFloat(this.employee.bestEmployeeBonusAmount)
      : 0;
    this.bestManagerBonusAmount = this.employee.bestManagerBonusAmount
      ? parseFloat(this.employee.bestManagerBonusAmount)
      : 0;
    this.thisMonthPaymentAmount = this.employee.thisMonthPaymentAmount
      ? parseFloat(this.employee.thisMonthPaymentAmount)
      : 0;
    this.checkVisible = this.employee.checkVisible
      ? this.employee.checkVisible
      : 'false';
    this.paymentCheckVisible = this.employee.paymentCheckVisible
      ? this.employee.paymentCheckVisible
      : 'false';
    this.paymentCode = this.employee.paymentCode
      ? this.employee.paymentCode
      : '';
    this.paymentAmount = this.employee.paymentAmount
      ? parseFloat(this.employee.paymentAmount)
      : 0;
    this.paymentIncreaseYears = this.employee.paymentIncreaseYears
      ? parseFloat(this.employee.paymentIncreaseYears)
      : 0;
    this.paymentAbsent = this.employee.paymentAbsent
      ? parseFloat(this.employee.paymentAbsent)
      : 0;
    this.paymentNothing = this.employee.paymentNothing
      ? parseFloat(this.employee.paymentNothing)
      : 0;
    this.paymentLate = this.employee.paymentLate
      ? parseFloat(this.employee.paymentLate)
      : 0;
    this.paymentBankFee = this.employee.paymentBankFee
      ? parseFloat(this.employee.paymentBankFee)
      : 0;
    this.paymentObjectiveWeekDeductionTotal =
      this.employee.paymentObjectiveWeekDeductionTotal
        ? parseFloat(this.employee.paymentObjectiveWeekDeductionTotal)
        : 0;
    this.paymentObjectiveWeekDeductions = Array.isArray(
      this.employee.paymentObjectiveWeekDeductions
    )
      ? this.employee.paymentObjectiveWeekDeductions.map((d) =>
          this.normalizeObjectiveDeduction(d)
        )
      : [];
    if (
      this.paymentObjectiveWeekDeductionTotal === 0 &&
      this.paymentObjectiveWeekDeductions.length > 0
    ) {
      this.recomputeObjectiveWeekDeductionTotal();
    }
    this.totalPayments = this.employee.totalPayments
      ? parseFloat(this.employee.totalPayments)
      : 0;
    this.contractSignVisible = this.employee.contractSignVisible
      ? this.employee.contractSignVisible
      : 'false';
    this.contractSignedAt = this.employee.contractSignedAt
      ? this.employee.contractSignedAt
      : '';
    this.contractSignatureName =
      this.employee.contractSignedBy ?? this.buildEmployeeName(this.employee);
    this.contractYear = this.employee.contractYear
      ? Number.parseInt(this.employee.contractYear, 10) || this.year
      : this.year;

    if (!this.weekObjectiveStartDate) {
      this.weekObjectiveStartDate = this.time.getTodaysDateYearMonthDay();
    }
    this.updateWeekObjectivePreview();
  }

  computeTotalBonusAmount() {
    this.totalBonusAmount =
      Number(this.bonusAmount) +
      Number(this.bestTeamBonusAmount) +
      Number(this.bestEmployeeBonusAmount) +
      Number(this.bestManagerBonusAmount);

    this.employee.totalPayments = this.totalBonusAmount.toString();
    this.employee.totalBonusThisMonth = this.totalBonusAmount.toString();
  }
  computeTotalPayment(): number {
    const amount = Number(this.paymentAmount) || 0;
    const bankFee = Number(this.paymentBankFee) || 0;
    const increase = Number(this.paymentIncreaseYears) || 0;
    const absent = Number(this.paymentAbsent) || 0;
    const late = Number(this.paymentLate) || 0;
    const nothing = Number(this.paymentNothing) || 0;
    const objectiveDeduction = Number(this.paymentObjectiveWeekDeductionTotal) || 0;

    this.totalPayments =
      amount + bankFee + increase - absent - late - nothing - objectiveDeduction;
    return this.totalPayments;
  }

  updateWeekObjectivePreview() {
    if (!this.weekObjectiveStartDate) {
      this.weekObjectiveEndDate = '';
      this.weekObjectiveEndLabel = '';
      return;
    }
    const startDate = this.parseIsoDate(this.weekObjectiveStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    this.weekObjectiveEndDate = this.formatIsoDate(endDate);
    this.weekObjectiveEndLabel = this.formatWeekDate(endDate);
  }

  addObjectiveWeekDeduction() {
    if (!this.weekObjectiveStartDate) {
      alert('Sélectionnez la date de début de semaine.');
      return;
    }
    const amount = Number(this.weekObjectiveAmount) || 0;
    if (amount <= 0) {
      alert('Entrez un montant valide.');
      return;
    }
    if (!this.weekObjectiveEndDate) {
      this.updateWeekObjectivePreview();
    }
    const entry: WeeklyObjectiveDeduction = {
      start: this.weekObjectiveStartDate,
      end: this.weekObjectiveEndDate,
      amount,
    };
    const existingIndex = this.paymentObjectiveWeekDeductions.findIndex(
      (d) => d.start === entry.start && d.end === entry.end
    );
    if (existingIndex >= 0) {
      this.paymentObjectiveWeekDeductions[existingIndex] = entry;
    } else {
      this.paymentObjectiveWeekDeductions.push(entry);
    }
    this.recomputeObjectiveWeekDeductionTotal();
    this.computeTotalPayment();
  }

  removeObjectiveWeekDeduction(index: number) {
    this.paymentObjectiveWeekDeductions.splice(index, 1);
    this.recomputeObjectiveWeekDeductionTotal();
    this.computeTotalPayment();
  }

  formatObjectiveWeekLabel(d: WeeklyObjectiveDeduction): string {
    const start = this.parseIsoDate(d.start);
    const end = this.parseIsoDate(d.end);
    return `${this.formatWeekDate(start)} - ${this.formatWeekDate(end)}`;
  }

  private recomputeObjectiveWeekDeductionTotal() {
    this.paymentObjectiveWeekDeductionTotal =
      this.paymentObjectiveWeekDeductions.reduce(
        (sum, d) => sum + (Number(d.amount) || 0),
        0
      );
  }

  private normalizeObjectiveDeduction(
    d: WeeklyObjectiveDeduction
  ): WeeklyObjectiveDeduction {
    if (!d?.start) {
      return { start: '', end: '', amount: 0 };
    }
    const startDate = this.parseIsoDate(d.start);
    const endDate = d.end
      ? this.parseIsoDate(d.end)
      : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
    return {
      start: d.start,
      end: this.formatIsoDate(endDate),
      amount: Number(d.amount) || 0,
    };
  }

  private parseIsoDate(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatWeekDate(date: Date): string {
    const days = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    const months = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    return `${dayName} ${date.getDate()} ${monthName} ${date.getFullYear()}`;
  }
  private resetEmployeeState(): void {
    this.employee = {};
    this.employees = [];
    this.paymentCodeLoaded = false;
    this.individualReviews = [];
    this.individualReviewsSub?.unsubscribe();
    this.individualReviewsSub = undefined;
    this.individualReviewsLoading = false;
  }
  async retrieveEmployees(): Promise<void> {
    this.employeesSub?.unsubscribe();
    this.employeesSub = this.auth
      .getAllEmployees()
      .subscribe(async (data: any) => {
        if (!data) {
          this.resetEmployeeState();
          return;
        }

        this.employees = Array.isArray(data) ? data : Object.values(data);
        const selectedIndex = Number(this.id);
        let selectedEmployee: Employee | undefined =
          Number.isFinite(selectedIndex) && selectedIndex >= 0
            ? this.employees[selectedIndex]
            : undefined;

        if (!selectedEmployee && typeof this.id === 'string') {
          selectedEmployee = this.employees.find((em) => em.uid === this.id);
        }

        if (!selectedEmployee) {
          this.resetEmployeeState();
          return;
        }

        this.employee = selectedEmployee;
        this.loadIndividualReviews(this.employee.uid);
        this.paymentCodeLoaded = true; // we now know employee.paymentCode

        // set location coordinates
        if (
          this.auth.currentUser &&
          this.auth.currentUser.locationCoordinates
        ) {
          this.locationCoordinate = this.auth.currentUser.locationCoordinates;
          this.currentLat = Number(this.locationCoordinate.lattitude);
          this.currentLng = Number(this.locationCoordinate.longitude);
        }
        this.loadAuditReceipts();
        if (this.employee.dateJoined) {
          this.yearsAtCompany = this.compute.yearsSinceJoining(
            this.employee.dateJoined
          );
        }

        this.findNumberOfVacationDaysLeft();
        this.getAllPayments();
        this.setEmployeeBonusAmounts();
        this.computeTotalBonusAmount();
        this.preposition = this.time.findPrepositionStartWithVowelOrConsonant(
          this.time.monthFrenchNames[this.givenMonth - 1]
        );

        this.maxRange = Object.keys(this.employee.dailyPoints!).length;
        if (this.employee.role === 'Manager') {
          let result = this.performance.findAverageAndTotalAllEmployee(
            this.employees
          );
          this.employee.averagePoints = `${result[0]} / ${result[1]}`;
          this.performancePercentageTotal = this.computePerformancePercentage(
            result[0].toString(),
            result[1].toString()
          );
          this.averageToday = this.performance.findAverageTotalToday(
            this.employees
          );
          this.totalToday = this.performance.findTotalToday(this.employees);

          this.averagePointsMonth =
            this.compute.findTotalForMonthAllDailyPointsEmployees(
              this.employees,
              this.givenMonth.toString(),
              this.givenYear.toString()
            );

          this.totalPointsMonth =
            this.compute.findTotalForMonthAllTotalDailyPointsEmployees(
              this.employees,
              this.givenMonth.toString(),
              this.givenYear.toString()
            );
        } else {
          let result = this.performance.findAverageAndTotal(this.employee);

          this.employee.averagePoints = `${result[0]} / ${result[1]}`;
          this.performancePercentageTotal = this.computePerformancePercentage(
            result[0].toString(),
            result[1].toString()
          );

          this.averageToday = this.employee!.dailyPoints![this.today];
          this.totalToday = this.employee.totalDailyPoints![this.today];

          this.averagePointsMonth = this.compute.findTotalForMonth(
            this.employee.dailyPoints!,
            this.givenMonth.toString(),
            this.givenYear.toString()
          );

          this.totalPointsMonth = this.compute.findTotalForMonth(
            this.employee.totalDailyPoints!,
            this.givenMonth.toString(),
            this.givenYear.toString()
          );
        }
        this.employee.performancePercantage = this.computePerformancePercentage(
          this.averageToday,
          this.totalToday
        );
        this.performancePercentageMonth = this.computePerformancePercentage(
          this.averagePointsMonth,
          this.totalPointsMonth
        );

        // this.computeThisMonthSalary();
        if (
          this.employee.attendance !== undefined &&
          this.employee.attendance[this.today] !== undefined
        ) {
          // console.log('hello', this.employee.attendance[this.today]);
          this.attendanceComplete = false;
        }
        // ⬇️  Load this month’s attachments first
        await this.loadMonthAttendanceAttachments(
          this.givenMonth,
          this.givenYear
        );

        this.generateAttendanceTable(this.givenMonth, this.givenYear);
        await this.loadDayTotalsForMonth(this.givenMonth, this.givenYear);
        this.generateCollectionsTable(this.givenMonth, this.givenYear);

        this.updatePerformanceGraphics(
          this.rangeValueFromPerformanceKey(this.performanceActiveRange)
        );
      });
  }

  toggleBonusIfCodeCorrect() {
    const entered = (this.code || '').trim();
    const expected = (this.paymentCode || '').trim();
    if (entered === expected && this.checkVisible === 'true') {
      this.toggleBonus();
      this.toggleCode();
    } else if (entered === expected && this.paymentCheckVisible === 'true') {
      this.togglePayment();
      this.toggleCode();
    } else {
      alert('Code incorrect. Essayez encore');
    }
  }
  computePerformancePercentage(average: string, total: string) {
    let result = '';
    if (
      (average === '0' || average === undefined || average === '') &&
      (total === '0' || total === undefined || total === '')
    ) {
    } else {
      let rounded = this.compute.roundNumber(
        (Number(average) * 100) / Number(total)
      );
      result = rounded.toString();
    }
    return result;
  }
  private aggregatePerformanceByMonth(): [string[], string[]] {
    const aggregates = new Map<string, { achieved: number; total: number }>();

    const accumulate = (
      dailyPoints?: { [key: string]: string },
      totalPoints?: { [key: string]: string }
    ) => {
      if (!dailyPoints) {
        return;
      }

      Object.entries(dailyPoints).forEach(([rawDate, rawAchieved]) => {
        // Parse date - format is "M-D-YYYY"
        const dateParts = rawDate.split('-');
        if (dateParts.length < 3) {
          return;
        }
        const month = dateParts[0];
        const year = dateParts[2];
        if (!month || !year) {
          return;
        }

        // Use parseFloat to match the circle calculation (findTotalForMonth uses parseFloat)
        const achieved = this.sanitizeNumeric(rawAchieved);
        const total = this.sanitizeNumeric(totalPoints?.[rawDate]);

        // Match circle calculation exactly: only include valid finite numbers, no fallbacks
        // This matches how findTotalForMonth and findTotalForMonthAllTotalDailyPointsEmployees work
        const safeAchieved = Number.isFinite(achieved) ? achieved : 0;
        const safeTotal = Number.isFinite(total) ? total : 0;

        const key = `${month}-${year}`;
        const previous = aggregates.get(key) ?? { achieved: 0, total: 0 };

        aggregates.set(key, {
          achieved: previous.achieved + safeAchieved,
          total: previous.total + safeTotal,
        });
      });
    };

    if (this.employee?.role === 'Manager') {
      (this.employees ?? []).forEach((member) =>
        accumulate(member?.dailyPoints, member?.totalDailyPoints)
      );
    } else {
      accumulate(this.employee?.dailyPoints, this.employee?.totalDailyPoints);
    }

    const sortedEntries = Array.from(aggregates.entries()).sort(
      ([keyA], [keyB]) => {
        const [monthA, yearA] = keyA.split('-').map(Number);
        const [monthB, yearB] = keyB.split('-').map(Number);

        const dateA = new Date(yearA || 0, (monthA || 1) - 1).getTime();
        const dateB = new Date(yearB || 0, (monthB || 1) - 1).getTime();

        return dateA - dateB;
      }
    );

    const labels = sortedEntries.map(([key]) => key);
    const values = sortedEntries.map(([_, aggregate]) => {
      const percentage =
        aggregate.total > 0 ? (aggregate.achieved / aggregate.total) * 100 : 0;
      return percentage.toString();
    });

    return [labels, values];
  }
  toggleMakePayment() {
    this.displayMakePayment = !this.displayMakePayment;
    this.currentDownloadUrl = '';
  }
  async setCode() {
    try {
      const previousCode = this.paymentCode;
      const nextCode = (this.code || '').trim();

      this.employee.paymentCode = nextCode;
      await this.data.updateEmployeePaymentCode(this.employee);

      if ((previousCode || '').trim() !== nextCode) {
        await this.auth.updateTeamCodeForPaymentCodeChange(
          previousCode,
          nextCode
        );
        this.paymentCode = nextCode;
      }
      this.toggleSetCode();
    } catch (error) {
      console.error('Error setting payment code:', error);
      // You might want to show an error message to the user here
    }
  }

  getAllPayments() {
    if (this.employee.payments !== undefined) {
      const paymentsArray = Object.entries(this.employee.payments!);

      paymentsArray.sort((a, b) => {
        const [rawA] = a;
        const [rawB] = b;

        const dateA = this.time.parseFlexibleDateTime(rawA);
        const dateB = this.time.parseFlexibleDateTime(rawB);

        return dateB.getTime() - dateA.getTime();
      });

      const currentPayments = paymentsArray;
      this.paymentAmounts = currentPayments.map((entry) => entry[1]);
      this.paymentDates = currentPayments.map((entry) =>
        this.time.convertTimeFormat(entry[0])
      );
    }
  }

  /* ─── helper to get filtered payments for display ─────────────────────── */
  getFilteredPayments() {
    // All users (admin and non-admin) see 2 initially, all if expanded
    const limit = !this.showAllPayments ? 2 : this.paymentAmounts.length;
    return Array.from(
      { length: Math.min(limit, this.paymentAmounts.length) },
      (_, i) => i
    );
  }
  togglePaymentCheckVisible() {
    this.paymentCheckVisible =
      this.paymentCheckVisible === 'true' ? 'false' : 'true';
  }
  updatePerformanceGraphics(range: number) {
    if (!this.employee) {
      this.performanceMaxRange = 0;
      this.maxRange = 0;
      this.graphPerformance = this.createEmptyPerformanceGraph();
      return;
    }

    const [labels, values] = this.aggregatePerformanceByMonth();
    this.performanceMaxRange = labels.length;
    this.maxRange = labels.length;

    const [selectedLabels, selectedValues] = this.sliceForRange(
      labels,
      values,
      range
    );

    if (!selectedLabels.length) {
      this.recentPerformanceDates = [];
      this.recentPerformanceNumbers = [];
      this.performanceGraphLabels = [];
      this.performanceGraphValues = [];
      this.graphPerformance = this.createEmptyPerformanceGraph();
      return;
    }

    this.recentPerformanceDates = selectedLabels;
    this.recentPerformanceNumbers = selectedValues.map((value) =>
      Number.parseFloat(value)
    );
    this.performanceGraphLabels = selectedLabels.map((label) =>
      this.formatMonthYearLabel(label)
    );
    this.performanceGraphValues = this.recentPerformanceNumbers.map((value) =>
      Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
    );

    const fallbackColor = selectedValues.length
      ? this.compute.findColor(selectedValues)
      : this.compute.colorPositive;

    const barColors = this.performanceGraphValues.length
      ? this.performanceGraphValues.map((value) =>
          this.colorForPerf(Number.isFinite(value) ? value : 0)
        )
      : [fallbackColor];

    this.graphPerformance = {
      data: [
        {
          x: this.performanceGraphLabels,
          y: this.performanceGraphValues,
          type: 'bar',
          marker: {
            color: barColors,
            line: { color: barColors, width: 1 },
          },
        },
      ],
      layout: this.createPerformanceLayout(),
    };
    if (!selectedLabels.length) {
      this.graphPerformance = this.createEmptyPerformanceGraph();
    }
    let num = Number(this.performancePercentageMonth);
    let gaugeColor = this.compute.getGradientColor(Number(num));

    this.graphMonthPerformance = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Performance ${
              this.time.monthFrenchNames[this.givenMonth - 1]
            } %`,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }

  setPerformanceRange(key: PerformanceRangeKey) {
    this.performanceActiveRange = key;
    this.updatePerformanceGraphics(this.rangeValueFromPerformanceKey(key));
  }

  private sliceForRange<T>(
    labels: T[],
    values: string[],
    range: number
  ): [T[], string[]] {
    if (!labels.length) {
      return [[], []];
    }

    const targetRange =
      range > 0 ? Math.min(range, labels.length) : labels.length;
    const startIndex = Math.max(labels.length - targetRange, 0);

    return [labels.slice(startIndex), values.slice(startIndex)];
  }

  private formatMonthYearLabel(key: string): string {
    const [month, year] = key.split('-');
    const monthIndex = Number(month) - 1;
    const monthName =
      this.time.monthFrenchNames?.[monthIndex] ??
      this.time.monthFrenchNames?.[((monthIndex % 12) + 12) % 12] ??
      month;
    return `${monthName} ${year}`.trim();
  }

  private sanitizeNumeric(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[\s,]/g, '');
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  private rangeValueFromPerformanceKey(key: PerformanceRangeKey): number {
    return this.performanceRangeMap[key] ?? 0;
  }

  private createPerformanceLayout() {
    return {
      title: 'Performance % par mois',
      barmode: 'stack',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#0f172a' },
      margin: { t: 48, r: 24, l: 48, b: 64 },
      yaxis: { ticksuffix: '%', rangemode: 'tozero' },
    };
  }

  private createEmptyPerformanceGraph(): PerformanceGraph {
    return {
      data: [
        {
          x: [] as string[],
          y: [] as number[],
          type: 'bar',
          marker: { color: this.compute.colorPositive },
        },
      ],
      layout: this.createPerformanceLayout(),
    };
  }

  onImageClick(): void {
    const fileInput = document.getElementById('getFile') as HTMLInputElement;
    fileInput.click();
  }

  async startUpload(event: FileList) {
    const file = event?.item(0);
    console.log('current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      console.log('unsupported file type');
      return;
    }

    if (file?.size >= 5000000) {
      alert(
        "L'image est trop grande. La taille maximale du fichier est de 5MB"
      );
      return;
    }

    let fileToUpload = file;

    // Check if the image is HEIC format and convert it
    if (file?.type === 'image/heic') {
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob: any = await heic2any({
          blob: file,
          toType: 'image/png',
          quality: 0.7,
        });

        fileToUpload = new File([convertedBlob], `${file.name}.png`, {
          type: 'image/png',
        });
      } catch (error) {
        console.error('Error converting HEIC to PNG:', error);
        return;
      }
    }

    const path = `invoice/${this.employee.firstName}-${this.employee.lastName}-${this.employee.paymentsPicturePath?.length}`;
    console.log('the path', path);

    const uploadTask = await this.storage.upload(path, fileToUpload);
    let url = await uploadTask.ref.getDownloadURL();
    this.currentDownloadUrl = url;
  }

  addPayment() {
    if (this.salaryPaid === '' || this.currentDownloadUrl === '') {
      alert('Remplissez toutes les données');
      return;
    } else if (Number.isNaN(Number(this.salaryPaid))) {
      alert('Entrée incorrecte. Entrez un nombre pour le montant');
      return;
    } else if (Number(this.salaryPaid) <= 0) {
      alert('le montant de paiement doit etre positifs ou plus grand que 0');
      return;
    } else {
      let conf = confirm(
        ` Vous voulez effectué un payment de  ${this.salaryPaid} $ a ${this.employee.firstName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.employee.paymentsPicturePath?.push(this.currentDownloadUrl);
      this.employee.salaryPaid = this.salaryPaid;
      this.data.addPaymentToEmployee(this.employee);
      this.data
        .updateEmployeePaymentPictureData(this.employee)
        .then(() => {})
        .then(() => {
          alert('Employé Paiement ajoutée avec Succès');
        })
        .catch((err) => {
          alert(
            "Une erreur s'est produite lors de l'ajout de Paiment de l'employé . Essayez encore."
          );
          console.log(err);
        });
      this.toggleMakePayment();
    }
  }
  getVacationInProgressDates(): string[] {
    return Object.keys(this.employee.attendance!)
      .filter((date) => this.employee.attendance![date] === 'VP')
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  generateInvoice() {
    this.compute.generateInvoice(this.employee);
  }
  generateInvoiceBonus() {
    this.compute.generateInvoice(this.employee, 'Bonus');
  }

  private hasAttendanceForLabel(label: string): boolean {
    const attendance = this.employee?.attendance || {};
    return Object.keys(attendance).some(
      (key) => this.normalizeLabel(key) === label
    );
  }

  generateAttendanceTable(month: number, year: number) {
    const tableBody = document.getElementById('attendance-body');
    // Ensure the element exists before proceeding
    if (!tableBody) {
      console.warn("Element with ID 'attendance-body' not found in the DOM.");
      return;
    }
    const dict: any = this.employee?.attendance || {}; // Use an empty object if attendance is null or undefined.
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();

    tableBody!.innerHTML = '';

    let date = 1;
    for (let i = 0; i < 6; i++) {
      // Maximum 6 rows to cover all days
      const row = document.createElement('tr');

      for (let j = 0; j < 7; j++) {
        const cell = document.createElement('td');
        if (i === 0 && j < firstDayIndex) {
          // Add empty cells for days before the 1st of the month
          cell.classList.add('not-filled');
          cell.innerHTML = '';
        } else if (date > daysInMonth) {
          // Add empty cells for days after the last day of the month
          cell.classList.add('bg-gray-200', 'p-16');
          cell.innerHTML = '';
        } else {
          // Build a date string that matches the beginning of the keys
          const dateStr = `${month}-${date}-${year}`;

          // Get all keys for this day
          const keysForDate = Object.keys(dict).filter((key) =>
            key.startsWith(dateStr)
          );

          // Pick the key with the latest time if available.
          // We assume the key format is: month-date-year-hour-minute-second.
          let matchedKey: string | undefined;
          if (keysForDate.length > 0) {
            matchedKey = keysForDate.reduce((prev, current) => {
              const partsPrev = prev.split('-');
              const partsCurrent = current.split('-');
              const hourPrev = parseInt(partsPrev[3] || '0', 10);
              const minutePrev = parseInt(partsPrev[4] || '0', 10);
              const secondPrev = parseInt(partsPrev[5] || '0', 10);
              const hourCurrent = parseInt(partsCurrent[3] || '0', 10);
              const minuteCurrent = parseInt(partsCurrent[4] || '0', 10);
              const secondCurrent = parseInt(partsCurrent[5] || '0', 10);
              const timePrev = hourPrev * 3600 + minutePrev * 60 + secondPrev;
              const timeCurrent =
                hourCurrent * 3600 + minuteCurrent * 60 + secondCurrent;
              return timeCurrent > timePrev ? current : prev;
            });
          }

          const attendance = matchedKey ? dict[matchedKey] : undefined;
          const keyUsed = matchedKey ?? dateStr;
          const dateLabel = dateStr;
          if (this.auth.isAdmninistrator) {
            cell.classList.add('cursor-pointer');
            cell.addEventListener('click', () =>
              this.onAttendanceCellClick(keyUsed, attendance, 'admin')
            );
          } else if (!attendance) {
            cell.classList.add('cursor-pointer');
            cell.addEventListener('click', () =>
              this.onAttendanceCellClick(dateLabel, undefined, 'employee')
            );
          }
          if (attendance) {
            // Extract hours and minutes from the matched key if available.
            const time = matchedKey!.split('-').slice(3, 5).join(':'); // e.g., "18:54" format

            if (attendance === 'P') {
              cell.classList.add(
                'bg-green-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Présent${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'A') {
              cell.classList.add(
                'bg-red-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Absent${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'VP') {
              cell.classList.add(
                'bg-blue-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Vacance En Cours...`;
            } else if (attendance === 'V') {
              cell.classList.add(
                'bg-yellow-400',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Vacance`;
            } else if (attendance === 'F') {
              cell.classList.add(
                'bg-rose-700',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Anomalie${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'L') {
              cell.classList.add(
                'bg-orange-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Retard${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'N') {
              cell.classList.add(
                'bg-gray-400',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Néant${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            }
          } else {
            // Default cell styling for days with no attendance data
            cell.classList.add('border', 'border-black', 'p-4');
            cell.innerHTML = date.toString();
          }
          // If an attachment exists for this date, append a small icon
          const att = this.findAttachmentForDay(dateLabel);
          if (att) {
            const btn = document.createElement('button');
            btn.className =
              'inline-flex items-center justify-center ml-1 mt-1 px-1.5 py-0.5 rounded bg-white/80 hover:bg-white ring-1 ring-black/10';
            btn.title = 'Voir la pièce jointe';
            btn.innerHTML = '📷'; // replace with an <svg> if you prefer
            btn.addEventListener('click', (ev) => {
              ev.stopPropagation(); // don't trigger cell click (admin edit)
              this.openAttachmentViewer(att, dateLabel);
            });
            cell.appendChild(btn);
          }

          date++;
        }
        row.appendChild(cell);
      }

      tableBody!.appendChild(row);

      if (date > daysInMonth) {
        break;
      }
    }
  }

  private resolveAttendanceTargetDate(mode: 'today' | 'yesterday'): Date {
    const now = new Date();
    // Get current date parts in Kinshasa timezone
    const kinPartsNow = this.kinParts(now);

    if (mode === 'yesterday') {
      // Calculate yesterday's date parts in Kinshasa timezone
      let y = kinPartsNow.y;
      let m = kinPartsNow.m;
      let d = kinPartsNow.d - 1;

      // Handle day rollover
      if (d < 1) {
        m -= 1;
        if (m < 1) {
          m = 12;
          y -= 1;
        }
        // Get the last day of the previous month
        d = new Date(y, m, 0).getDate();
      }

      // Create a Date object at noon UTC for the target day
      // This ensures that when converted to any timezone, it will still be the correct day
      // Kinshasa is UTC+1, so noon UTC = 1pm Kinshasa, safely in the middle of the day
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }

    // For today, create a date at noon UTC for today in Kinshasa timezone
    return new Date(
      Date.UTC(kinPartsNow.y, kinPartsNow.m - 1, kinPartsNow.d, 12, 0, 0)
    );
  }

  private dateToMonthDayYear(d: Date): string {
    const parts = this.kinParts(d);
    return `${parts.m}-${parts.d}-${parts.y}`;
  }

  private isoFromKinDate(d: Date): string {
    const parts = this.kinParts(d);
    const mm = String(parts.m).padStart(2, '0');
    const dd = String(parts.d).padStart(2, '0');
    return `${parts.y}-${mm}-${dd}`;
  }

  private buildLabelForTarget(targetDay: Date, takenAt?: Date): string {
    const dayParts = this.kinParts(targetDay);
    const timeParts = takenAt ? this.kinParts(takenAt) : dayParts;
    const mm = String(dayParts.m);
    const dd = String(dayParts.d);
    const yyyy = String(dayParts.y);
    const hh = String(timeParts.hh).padStart(2, '0');
    const mn = String(timeParts.mm).padStart(2, '0');
    const ss = String(timeParts.ss).padStart(2, '0');
    return `${mm}-${dd}-${yyyy}-${hh}-${mn}-${ss}`;
  }

  private hasConfirmedPresenceForDay(targetDay: Date): boolean {
    if (!this.employee?.attendance) return false;
    const baseLabel = this.dateToMonthDayYear(targetDay);
    return Object.entries(this.employee.attendance).some(([key, value]) => {
      if (value !== 'P' && value !== 'L') return false;
      return this.normalizeLabel(key) === baseLabel;
    });
  }

  get attendanceModalDateLabel(): string {
    const mdY = this.dateToMonthDayYear(this.attendanceTargetDate);
    return this.time.convertDateToDayMonthYear(mdY);
  }

  get attendanceCutoffLabel(): string {
    const { hour, minute } = this.getCutoffFor(this.attendanceTargetDate);
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  get shouldShowYesterdayPresence(): boolean {
    const target = this.resolveAttendanceTargetDate('yesterday');
    return !this.hasConfirmedPresenceForDay(target);
  }

  private openAttendanceModal(mode: 'today' | 'yesterday') {
    this.attendanceMode = mode;
    this.attendanceTargetDate = this.resolveAttendanceTargetDate(mode);
    this.clearAttachment(this.employee);
    this.displayAttendance = true;
  }

  closeAttendanceModal() {
    if (!this.displayAttendance) return;
    this.displayAttendance = false;
    this.clearAttachment(this.employee);
    this.attendanceMode = 'today';
    this.attendanceTargetDate = this.resolveAttendanceTargetDate('today');
    this.attendance = '';
  }

  toggleAttendance(mode: 'today' | 'yesterday' = 'today') {
    if (this.displayAttendance) {
      if (this.attendanceMode === mode) {
        this.closeAttendanceModal();
      } else {
        this.openAttendanceModal(mode);
      }
      return;
    }
    this.openAttendanceModal(mode);
  }
  async updateEmployeeBonusInfoAndSignCheck() {
    // Update bonus amounts
    this.employee.bonusPercentage = this.bonusPercentage.toString();
    this.employee.bonusAmount = this.bonusAmount.toString();
    this.employee.bestTeamBonusAmount = this.bestTeamBonusAmount.toString();
    this.employee.bestEmployeeBonusAmount =
      this.bestEmployeeBonusAmount.toString();
    this.employee.bestManagerBonusAmount =
      this.bestManagerBonusAmount.toString();
    this.toggle('isLoading');

    try {
      this.computeTotalBonusAmount(); // Recalculate total bonus after update
      await this.data.updateEmployeeBonusInfo(this.employee);
      const blob = await this.compute.generateBonusCheck(
        this.employee,
        'Bonus'
      );

      if (!blob) {
        throw new Error(
          "La génération du reçu de bonus a échoué. Merci d'essayer de nouveau."
        );
      }

      await this.uploadBonusCheck(blob, this.employee, 'bonus');

      await this.data.toggleEmployeeCheckVisibility(this.employee);
      this.checkVisible = this.checkVisible === 'true' ? 'false' : 'true';
      this.employee.checkVisible = this.checkVisible;

      alert('Bonus signé avec succès');
    } catch (err) {
      console.error('Erreur lors de la signature du bonus', err);
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur s'est produite lors de la signature du bonus. Réessayez.";
      alert(message);
    } finally {
      this.toggleBonus();
      this.toggle('isLoading');
    }
  }
  async updateEmployeePaymentInfo() {
    this.setPaymentInfo();
    try {
      await this.data.updateEmployeePaymentInfo(this.employee);
    } catch (err) {
      alert(err);
    } finally {
      this.togglePayment();
    }
  }

  setPaymentInfo() {
    // Ensure all fields are treated as numbers
    const p = (n: any) => Number(n) || 0;

    this.employee.paymentAmount = p(this.paymentAmount).toString();
    this.employee.paymentAbsent = p(this.paymentAbsent).toString();
    this.employee.paymentNothing = p(this.paymentNothing).toString();
    this.employee.paymentIncreaseYears = p(
      this.paymentIncreaseYears
    ).toString();
    this.employee.paymentBankFee = p(this.paymentBankFee).toString();
    this.employee.paymentLate = p(this.paymentLate).toString();
    this.employee.paymentObjectiveWeekDeductionTotal = p(
      this.paymentObjectiveWeekDeductionTotal
    ).toString();
    this.employee.paymentObjectiveWeekDeductions =
      this.paymentObjectiveWeekDeductions.map((d) => ({
        start: d.start,
        end: d.end,
        amount: Number(d.amount) || 0,
      }));
    this.employee.totalPayments = this.computeTotalPayment().toString();
  }
  async updateEmployeePaymentInfoAndSignCheck() {
    this.setPaymentInfo();
    // this.employee.paymentAmount = this.paymentAmount.toString();
    this.toggle('isLoading');
    try {
      await this.data.updateEmployeePaymentInfo(this.employee);
      const blob = await this.compute.generatePaymentCheck(
        this.employee,
        'Paiement',
        this.totalPayments.toString()
      );

      if (!blob) {
        throw new Error(
          "La génération du reçu de paiement a échoué. Merci d'essayer de nouveau."
        );
      }

      await this.uploadBonusCheck(blob, this.employee, 'Paiement');

      await this.data.toggleEmployeePaymentCheckVisibility(this.employee);
      this.togglePaymentCheckVisible();
      this.employee.paymentCheckVisible = this.paymentCheckVisible;

      alert('Paiement signé avec succès');
    } catch (err) {
      console.error('Erreur lors de la signature du paiement', err);
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur s'est produite lors de la signature du paiement. Réessayez.";
      alert(message);
    } finally {
      this.togglePayment();
      this.toggle('isLoading');
    }
  }

  private normalizeContractRole():
    | 'Manager'
    | 'Agent Marketing'
    | 'Manager Regionale'
    | 'Auditrice' {
    const role = (this.employee.role || '').toLowerCase();
    if (role.includes('region')) return 'Manager Regionale';
    if (role.includes('auditr')) return 'Auditrice';
    if (role.includes('manager')) return 'Manager';
    return 'Agent Marketing';
  }

  private buildSignedDateTime(): { full: string; dateOnly: string } {
    const now = new Date();
    const day = now.getDate();
    const monthIndex = now.getMonth();
    const year = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const full = `${day} ${this.time.monthFrenchNames[monthIndex]} ${year} ${hh}:${mm}:${ss}`;
    return {
      full,
      dateOnly: `${day} ${this.time.monthFrenchNames[monthIndex]} ${year}`,
    };
  }

  private buildContractView(
    signedDate = this.contractSignedAt || this.buildSignedDateTime().full,
    signedDateShort = this.contractSignedDateOnly ||
      signedDate.replace(/\s+\d{2}:\d{2}:\d{2}$/, '')
  ): ContractViewModel {
    const role = this.normalizeContractRole();
    const name = this.contractSignatureName || this.buildEmployeeName();
    const effectiveYear =
      Number.isFinite(this.contractYear) && this.contractYear
        ? this.contractYear
        : this.year;
    const effectiveDate = `Ce contrat est valable pour une durée d'un (1) an à compter du 1er janvier ${effectiveYear} renouvelable chaque année.`;
    // Get base salary from employee paymentAmount, fallback to role defaults if not set
    const baseSalary = this.employee?.paymentAmount 
      ? `${parseFloat(this.employee.paymentAmount)}$`
      : role === 'Manager Regionale' ? '150$' 
        : role === 'Auditrice' ? '110$'
          : role === 'Manager' ? '110$'
            : '90$'; // Agent Marketing default

    if (role === 'Manager') {
      return {
        title: 'Lettre D’Offre',
        subject:
          'Objet : Bienvenue à la Fondation Gervais - Votre rôle en tant que Manager',
        intro: [
          `Chère ${name},`,
          'Félicitations pour votre nomination en tant que Manager à la Fondation Gervais. Vous trouverez ci-dessous une description de vos responsabilités, de vos droits et des conditions de votre emploi.',
        ],
        effectiveDate,
        sections: [
          {
            title: 'Votre Rôle',
            bullets: [
              'Recruter de nouveaux clients chaque mois et assurer leur suivi actif, en se rendant sur leurs lieux de vente ou en les contactant directement lorsqu’un paiement n’est pas effectué, avec un objectif de suivi d’au moins trente (30) clients par employé.',
              'Garantir que les clients comprennent et respectent les accords, notamment les paiements à temps et l\'utilisation des crédits.',
              'Connaître vos clients et identifier ceux que vous devez visiter chaque jour.',
              'Encadrer les agents de marketing, les informer des priorités et surveiller leurs performances et les vôtres.',
              'Organiser des réunions quotidiennes pour vérifier l\'état de l\'équipe (santé, objectifs, etc.).',
              'Assurer la mise à jour des données en temps réel et résoudre tout problème signalé.',
              'Maintenir la discipline dans le bureau et veiller à la propreté de l\'espace.',
              'Mettre les commentaires claires chaque jour pour les clients qui n\'ont pas payer ce jour là.',
            ],
          },
          {
            title: 'Vos Paiements et Primes',
            bullets: [
              `Base mensuelle : ${baseSalary}`,
              'Être présent chaque jour au travail et confirmer sa présence par une photo claire prise sur le lieu de travail (logo ou élément visible du site). Toute photo floue ou non claire est considérée comme absence.',
              "Respecter les règles de travail : absence ou néant = –3 $ / jour, retard = –1 $ / jour. De plus, si l’équipe d’un site n’atteint pas 600 000 FC de paiements collectés sur la semaine, une retenue de 5 $ par employé est appliquée pour chaque semaine où l’objectif n’est pas atteint. Ce montant peut être réajusté au cours de l’année selon l’évolution des activités.",
              'Primes de performance (%) 30+ clients : À 50 %, la prime est de 10 $. Elle augmente de 10 $ à chaque palier supplémentaire de performance (ex. : 60–69 % = 20 $, 70–79 % = 30 $, etc.).',
              'Il y a aussi des primes des montants arbitraires si vous êtes membre de la meilleure équipe, ou parmi les 3 meilleurs employés du mois.',
              'Les paiements sont effectués dans un compte bancaire (RAWBANK, EQUITY) le 1er de chaque mois et les primes le 15 de chaque mois (ou la veille si le 1er ou le 15 tombe un week-end) et une augmentation de salaire de 10$ chaque année que vous demeurez dans la fondation.',
            ],
          },
          {
            title: 'Motifs de Licenciement',
            bullets: [
              "Si vous êtes pris en train de voler de l'argent, vous serez licencié immédiatement.",
              'Si l’équipe et/ou l’employé ne parviennent pas à atteindre l’objectif de paiements hebdomadaires à cinq (5) reprises sur une période de trois (3) mois, une notification sera adressée.',
              'Si vous êtes impliqué(e) dans des insultes ou des actes de violence de quelque nature que ce soit, vous serez licencié(e) ou suspendu selon la gravité des actes commis.',
              'Pour tous les détails concernant les Cas de Vol, veuillez consulter la section "Aperçu et Tutoriels" dans le système, dernière section.',
            ],
          },
          {
            title: 'Vos Droits',
            bullets: [
              'Chaque employé a droit à sept (7) jours de congé par année civile. Les jours de congé non utilisés sont cumulables d\'une année à l\'autre, dans la limite maximale de trente (30) jours. Au-delà de ce plafond, aucun jour supplémentaire ne peut être accumulé.',
              'Paiement transparent et primes de performance.',
              'Accès aux équipements nécessaires pour superviser les opérations.',
            ],
          },
        ],
        closing: [
          'Ce document peut être mis à jour selon les besoins de la Fondation. Toute modification vous sera communiquée en temps opportun.',
          'Nous sommes convaincus que votre leadership renforcera l’impact de la Fondation Gervais et contribuera à son succès.',
          'Cordialement,',
        ],
        signedDate,
        signedDateShort,
        roleLabel: role,
        signatureDataUrl: this.signatureDataUrl || undefined,
      };
    }

    if (role === 'Manager Regionale') {
      return {
        title: 'Lettre D’Offre',
        subject:
          'Objet : Bienvenue à la Fondation Gervais - Votre rôle en tant que Manager Régionale',
        intro: [
          `Chère ${name},`,
          'Nous sommes heureux de vous accueillir à la Fondation Gervais en tant que Manager Régionale. Vous trouverez ci-dessous les détails concernant vos responsabilités, vos droits et vos obligations dans ce rôle essentiel.',
        ],
        effectiveDate,
        sections: [
          {
            title: 'Votre Rôle',
            bullets: [
              'Recruter de nouveaux clients chaque mois et assurer leur suivi actif, en se rendant sur leurs lieux de vente ou en les contactant directement lorsqu’un paiement n’est pas effectué, avec un objectif de suivi d’au moins trente (30) clients par employé.',
              'Ouvrir et établir de nouveaux emplacements.',
              'Recruter et former de nouveaux employés à la mission et à la vision de la Fondation.',
              'Faciliter la distribution des fonds aux différents emplacements.',
              "Résoudre immédiatement tout problème qui survient et, en cas d'incapacité, l'escalader auprès de l’hiérarchie.",
            ],
          },
          {
            title: 'Vos Paiements et Primes',
            bullets: [
              `Base mensuelle : ${baseSalary}`,
              'Être présent chaque jour au travail et confirmer sa présence par une photo claire prise sur le lieu de travail (logo ou élément visible du site). Toute photo floue ou non claire est considérée comme absence.',
              'Respecter les règles de travail : absence ou néant = –3 $ / jour, retard = –1 $ / jour.',
              'Primes de performance Distribution(%) par rapport au minimum de perte accru : 30$ (si la perte est de moins de 2%).',
              'Les paiements sont effectués dans un compte bancaire (RAWBANK) le 1er de chaque mois et les primes le 15 de chaque mois (ou la veille si le 1er ou le 15 tombe un week-end) et une augmentation de salaire de base de 10$ chaque année que vous demeurez dans la fondation.',
              "D'autres primes seront accordées en fonction de l'efficacité de votre travail dans l'accomplissement de tâches spécifiques, à la discrétion du conseil d'administration.",
            ],
          },
          {
            title: 'Motifs de Licenciement',
            bullets: [
              "Si vous êtes pris en train de voler de l'argent, vous serez licencié immédiatement.",
              'Si vous êtes pris en train de falsifier les renseignements ou de ne pas vérifier les clients et prétendre que vous avez contacté les clients, vous serez licencié immédiatement.',
              "Si vous recevez de l'argent ou un pot-de-vin du manager ou de l'agent de marketing pour leur donner des faveurs.",
              'Si vous êtes impliqué(e) dans des insultes ou des actes de violence de quelque nature que ce soit, vous serez licencié(e) ou suspendu selon la gravité des actes commis.',
              'Pour tous les détails concernant les Cas de Vol, veuillez consulter la section "Aperçu et Tutoriels" dans le système, dernière section.',
            ],
          },
          {
            title: 'Vos Droits',
            bullets: [
              'Chaque employé a droit à sept (7) jours de congé par année civile. Les jours de congé non utilisés sont cumulables d\'une année à l\'autre, dans la limite maximale de trente (30) jours. Au-delà de ce plafond, aucun jour supplémentaire ne peut être accumulé.',
              'Paiement transparent avec primes basées sur vos performances et contributions.',
              'Accès aux outils et informations nécessaires pour effectuer vos audits efficacement.',
            ],
          },
        ],
        closing: [
          'Nous avons hâte de bénéficier de votre expertise et de voir comment vos observations contribueront à l\'amélioration de nos processus et à la réussite de notre mission.',
          'Cordialement,',
        ],
        signedDate,
        signedDateShort,
        roleLabel: role,
        signatureDataUrl: this.signatureDataUrl || undefined,
      };
    }

    if (role === 'Auditrice') {
      return {
        title: 'Lettre D’Offre',
        subject:
          "Objet : Bienvenue à la Fondation Gervais - Votre rôle en tant qu'Auditrice",
        intro: [
          `Chère ${name},`,
          "Nous sommes heureux de vous accueillir à la Fondation Gervais en tant qu'auditrice. Vous trouverez ci-dessous les détails concernant vos responsabilités, vos droits et vos obligations dans ce rôle essentiel.",
        ],
        effectiveDate,
        sections: [
          {
            title: 'Votre Rôle',
            bullets: [
              'Identifier tous les types de problèmes au sein des opérations et des équipes et informer immédiatement la hiérarchie.',
              'Appeler et vérifier les clients lors de l\'enregistrement.',
              'Observer et analyser la manière dont le travail est réalisé.',
              'Inspecter une équipe pendant une semaine et acquérir une bonne connaissance de la plupart des clients de cette équipe.',
              'Comparer les informations entre le système et les carnets de notes pour s’assurer de leur concordance.',
              'Faciliter la distribution des fonds aux différents emplacements.',
              'Recruter de nouveaux candidats et autres selon les besoins.',
            ],
          },
          {
            title: 'Vos Paiements et Primes',
            bullets: [
              `Base mensuelle : ${baseSalary}`,
              'Être présent chaque jour au travail et confirmer sa présence par une photo claire prise sur le lieu de travail (logo ou élément visible du site). Toute photo floue ou non claire est considérée comme absence.',
              'Respecter les règles de travail : absence ou néant = –3 $ / jour, retard = –1 $ / jour.',
              'Primes de performance Distribution(%) par rapport au minimum de perte accru : 30$ (si la perte est de moins de 2%).',
              'Les paiements sont effectués dans un compte bancaire (RAWBANK, EQUITY) le 1er de chaque mois et les primes le 15 de chaque mois (ou la veille si le 1er ou le 15 tombe un week-end) et une augmentation de salaire de base de 10$ chaque année que vous demeurez dans la fondation.',
              "D'autres primes seront accordées en fonction de l'efficacité de votre travail dans l'accomplissement de tâches spécifiques, à la discrétion du conseil d'administration.",
            ],
          },
          {
            title: 'Motifs de Licenciement',
            bullets: [
              "Si vous êtes pris en train de voler de l'argent, vous serez licencié immédiatement.",
              'Si vous êtes pris en train de falsifier les renseignements ou de ne pas vérifier les clients et prétendre que vous avez contacté les clients, vous serez licencié immédiatement.',
              "Si vous recevez de l'argent ou un pot-de-vin du manager ou de l'agent de marketing pour leur donner des faveurs.",
              'Si vous êtes impliqué(e) dans des insultes ou des actes de violence de quelque nature que ce soit, vous serez licencié(e) ou suspendu selon la gravité des actes commis.',
              'Pour tous les détails concernant les Cas de Vol, veuillez consulter la section "Aperçu et Tutoriels" dans le système, dernière section.',
            ],
          },
          {
            title: 'Vos Droits',
            bullets: [
              'Chaque employé a droit à sept (7) jours de congé par année civile. Les jours de congé non utilisés sont cumulables d\'une année à l\'autre, dans la limite maximale de trente (30) jours. Au-delà de ce plafond, aucun jour supplémentaire ne peut être accumulé.',
              'Paiement transparent avec primes basées sur vos performances et contributions.',
              'Accès aux outils et informations nécessaires pour effectuer vos audits efficacement.',
            ],
          },
        ],
        closing: [
          'Ce document peut être mis à jour selon les besoins de la Fondation. Toute modification vous sera communiquée en temps opportun.',
          'Nous avons hâte de bénéficier de votre expertise et de voir comment vos observations contribueront à l\'amélioration de nos processus et à la réussite de notre mission.',
          'Cordialement,',
        ],
        signedDate,
        signedDateShort,
        roleLabel: role,
        signatureDataUrl: this.signatureDataUrl || undefined,
      };
    }

    return {
      title: 'Lettre D’Offre',
      subject:
        "Objet : Bienvenue à la Fondation Gervais - Votre rôle en tant qu'Agent de Marketing",
      intro: [
        `Chère ${name},`,
        'Nous sommes ravis de vous accueillir à la Fondation Gervais en tant qu’Agent de Marketing. Vous trouverez ci-dessous une description de vos responsabilités, de vos droits et des conditions de votre emploi.',
      ],
      effectiveDate,
      sections: [
        {
          title: 'Votre Rôle',
          bullets: [
            'Recruter de nouveaux clients chaque mois et assurer leur suivi actif, en se rendant sur leurs lieux de vente ou en les contactant directement lorsqu’un paiement n’est pas effectué, avec un objectif de suivi d’au moins trente (30) clients par employé.',
            'Respecter les clients et éviter tout conflit, quelles que soient les circonstances.',
            'Connaître vos clients et identifier ceux que vous devez visiter chaque jour.',
            'Mettre à jour les données de paiement des clients en temps réel.',
            'Informer votre responsable de tout problème rencontré.',
            'Escalater tout problème non résolu avec votre manager à la hiérarchie.',
            'Maintenir la propreté et l\'organisation de l\'environnement de travail.',
            'Mettre les commentaires claires chaque jour pour les clients qui n\'ont pas payer ce jour là.',
          ],
        },
        {
          title: 'Vos Paiements et Primes',
          bullets: [
            `Base mensuelle : ${baseSalary}`,
            'Être présent chaque jour au travail et confirmer sa présence par une photo claire prise sur le lieu de travail (logo ou élément visible du site). Toute photo floue ou non claire est considérée comme absence.',
            "Respecter les règles de travail : absence ou néant = –3 $ / jour, retard = –1 $ / jour. De plus, si l’équipe d’un site n’atteint pas 600 000 FC de paiements collectés sur la semaine, une retenue de 5 $ par employé est appliquée pour chaque semaine où l’objectif n’est pas atteint. Ce montant peut être réajusté au cours de l’année selon l’évolution des activités.",
            'Primes de performance (%) 30+ clients : À 50 %, la prime est de 10 $. Elle augmente de 10 $ à chaque palier supplémentaire de performance (ex. : 60–69 % = 20 $, 70–79 % = 30 $, etc.).',
            'Il y a aussi des primes des montants arbitraires si vous êtes membre de la meilleure équipe, ou parmi les 3 meilleurs employés du mois.',
            'Les paiements sont effectués dans un compte bancaire (RAWBANK) le 1er de chaque mois, les primes le 15 de chaque mois (ou la veille si le 1er ou le 15 tombe un week-end) et une augmentation de salaire de 10$ chaque année que vous demeurez dans la fondation.',
          ],
        },
        {
          title: 'Motifs de Licenciement',
          bullets: [
            "Si vous êtes pris en train de voler de l'argent, vous serez licencié immédiatement.",
            'Si l’équipe et/ou l’employé ne parviennent pas à atteindre l’objectif de paiements hebdomadaires à cinq (5) reprises sur une période de trois (3) mois, une notification sera adressée.',
            'Si vous êtes impliqué(e) dans des insultes ou des actes de violence de quelque nature que ce soit, vous serez licencié(e) ou suspendu selon la gravité des actes commis.',
            'Pour tous les détails concernant les Cas de Vol, veuillez consulter la section "Aperçu et Tutoriels" dans le système, dernière section.',
          ],
        },
        {
          title: 'Vos Droits',
          bullets: [
            'Chaque employé a droit à sept (7) jours de congé par année civile. Les jours de congé non utilisés sont cumulables d\'une année à l\'autre, dans la limite maximale de trente (30) jours. Au-delà de ce plafond, aucun jour supplémentaire ne peut être accumulé.',
            'Paiement transparent et primes de performance.',
            'Accès aux équipements nécessaires pour accomplir vos tâches.',
          ],
        },
      ],
      closing: [
        'Ce document peut être mis à jour selon les besoins de la Fondation. Toute modification vous sera communiquée en temps opportun.',
        'Nous avons hâte de voir l’impact positif que vous apporterez à la Fondation Gervais.',
        'Cordialement,',
      ],
      signedDate,
      signedDateShort,
      roleLabel: role,
      signatureDataUrl: this.signatureDataUrl || undefined,
    };
  }

  isBaseSalaryBullet(text: string): boolean {
    return text.trim().toLowerCase().startsWith(this.baseSalaryLabel.toLowerCase());
  }

  getBaseSalaryAmount(text: string): string {
    const match = text.match(/base mensuelle\s*:\s*(.+)$/i);
    if (!match) return '';
    return match[1].trim();
  }

  openContractModal() {
    const signedDate = this.buildSignedDateTime();
    this.contractView = this.buildContractView(
      signedDate.full,
      signedDate.dateOnly
    );
    this.initSignaturePad();
    this.clearSignaturePad();
    this.displayContract = true;
  }

  closeContractModal() {
    this.displayContract = false;
  }

  async toggleContractSignVisibility() {
    try {
      await this.data.toggleEmployeeContractSignVisibility(this.employee);
      this.contractSignVisible =
        this.contractSignVisible === 'true' ? 'false' : 'true';
      this.employee.contractSignVisible = this.contractSignVisible;
    } catch (error) {
      console.error('Error toggling contract signature visibility:', error);
      alert(
        "Une erreur s'est produite lors du basculement de la signature du contrat."
      );
    }
  }

  async signContract() {
    if (!this.employee?.uid) {
      alert('Employé introuvable, impossible de générer le contrat.');
      return;
    }
    this.contractYear = this.year;
    if (!this.contractSignatureName) {
      this.contractSignatureName = this.buildEmployeeName();
    }
    const signedDate = this.buildSignedDateTime();
    this.contractView = this.buildContractView(
      signedDate.full,
      signedDate.dateOnly
    );
    if (this.signatureDataUrl) {
      this.contractView.signatureDataUrl = this.signatureDataUrl;
    }
    this.toggle('isLoading');

    try {
      const blob = await this.compute.generateContractDocument(
        this.employee,
        this.contractView
      );

      const url = await this.uploadContractDocument(
        blob,
        this.employee,
        signedDate.full,
        this.contractView.roleLabel
      );

      this.contractSignedAt = signedDate.full;
      this.contractSignedDateOnly = signedDate.dateOnly;
      this.employee.contractSignedAt = signedDate.full;
      this.employee.contractSignedBy = this.contractSignatureName;
      this.employee.contractYear = this.contractYear.toString();
      this.contractSignVisible = 'false';
      this.employee.contractSignVisible = 'false';
      this.employee.contract = url;

      alert('Contrat signé avec succès');
    } catch (err) {
      console.error('Erreur lors de la signature du contrat', err);
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur s'est produite lors de la signature du contrat. Réessayez.";
      alert(message);
    } finally {
      this.toggle('isLoading');
      this.displayContract = false;
    }
  }

  private signatureCoords(event: PointerEvent): { x: number; y: number } {
    const rect = this.signaturePad.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
  }

  private initSignaturePad() {
    if (!this.signaturePad) return;
    this.signatureContext = this.signaturePad.nativeElement.getContext('2d');
    if (!this.signatureContext) return;
    this.signatureContext.strokeStyle = '#111827';
    this.signatureContext.lineWidth = 2;
    this.signatureContext.lineJoin = 'round';
    this.signatureContext.lineCap = 'round';
  }

  onSignatureStart(event: PointerEvent) {
    if (!this.signaturePad) return;
    if (!this.signatureContext) {
      this.initSignaturePad();
    }
    if (!this.signatureContext) return;
    this.isDrawingSignature = true;
    const { x, y } = this.signatureCoords(event);
    this.signatureContext.beginPath();
    this.signatureContext.moveTo(x, y);
  }

  onSignatureMove(event: PointerEvent) {
    if (!this.isDrawingSignature || !this.signatureContext) return;
    const { x, y } = this.signatureCoords(event);
    this.signatureContext.lineTo(x, y);
    this.signatureContext.stroke();
  }

  onSignatureEnd() {
    if (!this.signaturePad) return;
    if (this.isDrawingSignature && this.signatureContext) {
      this.signatureContext.closePath();
      const dataUrl = this.signaturePad.nativeElement.toDataURL('image/png');
      this.signatureDataUrl = dataUrl;
      this.contractSignatureImage = dataUrl;
    }
    this.isDrawingSignature = false;
  }

  clearSignaturePad() {
    if (!this.signaturePad) return;
    const canvas = this.signaturePad.nativeElement;
    const ctx = this.signatureContext || canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.signatureDataUrl = '';
    this.contractSignatureImage = null;
  }
  private async uploadContractDocument(
    blob: Blob,
    employee: Employee,
    signedDate: string,
    roleLabel: 'Manager' | 'Agent Marketing' | 'Manager Regionale' | 'Auditrice'
  ): Promise<string> {
    if (!(blob instanceof Blob)) {
      throw new Error('Le contrat généré est invalide.');
    }

    const baseName = this.buildEmployeeName(employee) || 'employe';
    const safeName = baseName.replace(/[^a-z0-9\-]+/gi, '_').toLowerCase();
    const path = `contracts/${safeName}-${Date.now()}.pdf`;
    let uploadedPath: string | null = null;

    try {
      const uploadTask = await this.storage.upload(path, blob);
      uploadedPath = path;
      const url = await uploadTask.ref.getDownloadURL();

      await this.data.updateEmployeeContractDocument(employee, {
        contract: url,
        signedAt: signedDate,
        signedBy: this.contractSignatureName || baseName,
        contractYear: this.contractYear.toString(),
        contractRole: roleLabel,
        contractSignVisible: 'false',
        contractSignatureImage: this.signatureDataUrl || null,
      });

      return url;
    } catch (error) {
      if (uploadedPath) {
        try {
          await firstValueFrom(this.storage.ref(uploadedPath).delete());
        } catch {
          // ignore cleanup failure
        }
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Échec lors de l'enregistrement du contrat. Veuillez réessayer."
      );
    }
  }
  async updateEmployeeBonusInfo() {
    // Update bonus amounts
    this.employee.bonusPercentage = this.bonusPercentage.toString();
    this.employee.bonusAmount = this.bonusAmount.toString();
    this.employee.bestTeamBonusAmount = this.bestTeamBonusAmount.toString();
    this.employee.bestEmployeeBonusAmount =
      this.bestEmployeeBonusAmount.toString();
    this.employee.bestManagerBonusAmount =
      this.bestManagerBonusAmount.toString();

    try {
      this.computeTotalBonusAmount();
      await this.data.updateEmployeeBonusInfo(this.employee);
      // this.computeTotalBonusAmount();
    } catch (err) {
      alert(
        "Une erreur s'est produite lors de la modification de l'employé. Essayez encore."
      );
      console.error(err);
    } finally {
      this.toggleBonus();
    }
  }
  async uploadBonusCheck(
    blob: Blob,
    employee: Employee,
    total: 'bonus' | 'Paiement' = 'bonus'
  ): Promise<string> {
    if (!(blob instanceof Blob)) {
      throw new Error('Le fichier généré est invalide.');
    }

    const timestamp = Date.now();
    const path = `invoice/${employee.firstName}-${employee.lastName}-${timestamp}.pdf`;
    const previousPaths = [...(employee.paymentsPicturePath ?? [])];
    const previousSalaryPaid = employee.salaryPaid;
    let uploadedPath: string | null = null;

    try {
      const uploadTask = await this.storage.upload(path, blob);
      uploadedPath = path;
      const url = await uploadTask.ref.getDownloadURL();

      const updatedPaths = [...previousPaths, url];
      employee.paymentsPicturePath = updatedPaths;
      await this.data.updateEmployeePaymentPictureData(employee);

      const amountNumber =
        total === 'bonus' ? this.totalBonusAmount : this.totalPayments;

      if (!Number.isFinite(amountNumber)) {
        throw new Error(
          'Montant de reçu invalide. Vérifiez les données de paiement.'
        );
      }

      employee.salaryPaid = amountNumber.toString();
      const context = total === 'bonus' ? 'bonus' : 'paiement';
      await this.data.addPaymentToEmployee(employee, context);

      return url;
    } catch (error) {
      employee.paymentsPicturePath = previousPaths;
      employee.salaryPaid = previousSalaryPaid;

      if (uploadedPath) {
        try {
          await firstValueFrom(this.storage.ref(uploadedPath).delete());
        } catch {
          // Ignore cleanup failure
        }
      }

      try {
        await this.data.updateEmployeePaymentPictureData(employee);
      } catch {
        // Ignore rollback failure
      }

      console.error('Échec lors du stockage du reçu signé', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Échec de l'enregistrement du reçu. Veuillez réessayer dans un instant."
      );
    }
  }

  async addAttendance(toggle = true, date = '') {
    if (this.attendance === '') {
      alert('Remplissez la presence, Réessayez');
      return;
    }
    try {
      const key = date ? date : this.time.todaysDate(); // if plain date, fine; if with time, great
      const update = { [key]: this.attendance };

      await this.data.updateEmployeeAttendance(update, this.employee.uid!);
      // await. this.data.updateAttendanceKey()

      // 🔵 local refresh
      this.employee.attendance = {
        ...(this.employee.attendance ?? {}),
        ...update,
      };
      this.generateAttendanceTable(this.givenMonth, this.givenYear);
    } catch (err) {
      alert("Une erreur s'est produite lors de l'attendance, Réessayez");
      return;
    }
    this.attendance = '';
    if (toggle) this.closeAttendanceModal();
  }

  clearAttachment(em: any) {
    if (!em) return;
    em._attachmentError = '';
    em._attachmentFile = null;
    em._attachmentPreview = null;
    em._attachmentType = null;
    em._attachmentSize = null;
    em._attachmentTakenAt = null;
    em._attachmentTakenAtSource = '';
    em._attachmentDeviceInfo = null;
    em._attachmentUA = null;
    em._attachmentSoftId = null;
    em._attachmentHash = null;
    em._uploading = false;
  }

  async addAttendanceForEmployee(
    employee: any,
    attendanceValue: string,
    dateLabel: string = '',
    targetDay?: Date
  ) {
    if (!attendanceValue) {
      alert('Remplissez la présence, Réessayez');
      return;
    }

    this.savingAttendance = true;
    try {
      const target = targetDay ? new Date(targetDay.getTime()) : new Date();
      const label =
        dateLabel && dateLabel.trim() ? dateLabel : this.time.todaysDate();
      const dateISO = targetDay
        ? this.isoFromKinDate(target)
        : target.toISOString().slice(0, 10);
      const plainLabel = this.normalizeLabel(label, dateISO);

      // 1) legacy + day-doc writes (existing code) ...
      await this.data.updateEmployeeAttendanceForUser(
        { [label]: attendanceValue },
        employee.uid!,
        this.auth.currentUser.uid
      );
      await this.data.setAttendanceEntry(
        this.auth.currentUser.uid,
        employee.uid!,
        dateISO,
        attendanceValue as any,
        label,
        this.auth.currentUser?.uid || 'unknown'
      );

      // 2) optional attachment (ENRICH WITH takenAt)
      let attMeta: any = null;
      if (employee._attachmentFile) {
        employee._uploading = true;

        // read the “first created” date BEFORE uploading
        const when = await this.readFirstCreated(employee._attachmentFile);

        attMeta = await this.data.uploadAttendanceAttachment(
          employee._attachmentFile,
          employee.uid!,
          this.auth.currentUser.uid,
          dateISO,
          this.auth.currentUser?.uid || 'unknown',
          label
        );

        // persist takenAt + source with the attachment document
        if (when.date) {
          attMeta = {
            ...attMeta,
            takenAt: when.date.getTime(),
            takenAtSource: when.source,
          };
        }
        attMeta = {
          ...attMeta,
          device: employee._attachmentDeviceInfo || null,
          ua: employee._attachmentUA || this.getUaInfo(),
          softDeviceId: employee._attachmentSoftId || this.ensureSoftDeviceId(),
          photoHash:
            employee._attachmentHash ||
            (employee._attachmentFile
              ? await this.hashFile(employee._attachmentFile)
              : null),
        };
        await this.data.addAttendanceAttachmentDoc(
          this.auth.currentUser.uid,
          employee.uid!,
          dateISO,
          attMeta
        );

        employee._uploading = false;
        this.clearAttachment(employee);
      }

      // local refresh (existing) ...
      this.employee.attendance = this.employee.attendance || {};
      this.employee.attendance[label] = attendanceValue;
      if (attMeta) {
        this.monthAttachmentsByLabel[plainLabel] = [
          ...(this.monthAttachmentsByLabel[plainLabel] ?? []),
          attMeta,
        ];
      }
      this.generateAttendanceTable(this.givenMonth, this.givenYear);

      await this.sleep(350);
      this.displayAttendance = false;
      alert('Présence ajoutée avec succès');
    } catch (e) {
      console.error(e);
      alert("Une erreur s'est produite lors de l'attendance, Réessayez");
    } finally {
      this.savingAttendance = false;
    }
  }

  acceptVacation(date: string) {
    if (!this.employee.attendance || this.employee.attendance[date] !== 'VP') {
      console.error(`Date ${date} not in progress or not found.`);
      return;
    }

    // Update attendance from VP to V
    this.employee.attendance[date] = 'V';

    // Increase the number of accepted vacations
    let acceptedVacations =
      Number(this.employee.vacationAcceptedNumberOfDays) || 0;
    acceptedVacations += 1;
    this.employee.vacationAcceptedNumberOfDays = acceptedVacations.toString();

    console.log(
      'Updated attendance after acceptance:',
      this.employee.attendance
    );

    // Update the database
    this.data
      .updateEmployeeAttendance(
        { ...this.employee.attendance },
        this.employee.uid!
      )
      .then(() => {
        this.data.updateEmployeeNumberOfAcceptedVacation(
          acceptedVacations.toString(),
          this.employee.uid!
        );
        console.log('Acceptance successfully updated in the database.');
      })
      .catch((error) => {
        console.error('Error updating acceptance in the database:', error);
      });
  }

  rejectVacation(date: string) {
    if (!this.employee.attendance || !this.employee.attendance[date]) {
      console.error(`Date ${date} not found in attendance.`);
      return;
    }

    // Remove the entry from the attendance object
    delete this.employee.attendance[date];

    console.log(
      'Updated attendance after rejection:',
      this.employee.attendance
    );

    let vacationRequests =
      Number(this.employee.vacationRequestNumberOfDays) || 0;
    if (vacationRequests > 0) {
      vacationRequests -= 1;
      this.employee.vacationRequestNumberOfDays = vacationRequests.toString();
    }

    // Update the database
    this.data
      .updateEmployeeAttendanceRejection(
        { ...this.employee.attendance },
        this.employee.uid!
      )
      .then(() => {
        this.data.updateEmployeeNumberOfVacationRequest(
          vacationRequests.toString(),
          this.employee.uid!
        );
        console.log('Rejection successfully updated in the database.');
      })
      .catch((error) => {
        console.error('Error updating rejection in the database:', error);
      });
  }

  async toggleCheckVisibility() {
    try {
      await this.data.toggleEmployeeCheckVisibility(this.employee);
      // Optionally, you can add a success message here
      // console.log('Check visibility toggled successfully');
    } catch (error) {
      console.error('Error toggling check visibility:', error);
      // Optionally, you can show an alert or handle the error in some way
      alert(
        'An error occurred while toggling check visibility. Please try again.'
      );
    }
  }
  async togglePaymentCheckVisibility() {
    try {
      await this.data.toggleEmployeePaymentCheckVisibility(this.employee);
      // console.log('Payment check visibility toggled successfully');
    } catch (error) {
      console.error('Error toggling payment check visibility:', error);
      alert(
        'An error occurred while toggling payment check visibility. Please try again.'
      );
    }
  }
  // Method to set the current location as the workplace
  setLocation(): void {
    this.compute
      .getLocation()
      .then((position) => {
        this.currentLat = position.coords.latitude;
        this.currentLng = position.coords.longitude;
        this.locationSet = true;
        if (this.locationSet) {
          alert("l'emplacement a été défini!");
        }
        this.errorMessage = null; // Clear any previous error
        const loc: LocationCoordinates = {
          longitude: this.currentLng.toString(),
          lattitude: this.currentLat.toString(),
        };
        try {
          // add location to the database
          const setL = this.data.setLocation(loc);
        } catch (error) {
          alert("Une erreur s'est produite. Veuillez réessayer.");
          console.error('Error setting location:', error);
          this.errorMessage = 'Failed to set location. Please try again.';
        }
        console.log(
          `Location set: Latitude ${this.currentLat}, Longitude ${this.currentLng}`
        );
      })
      .catch((error) => {
        this.errorMessage = error.message;
        this.locationSet = false;
      });
  }

  async determineAttendance(): Promise<void> {
    // Vérifie que le lieu de travail est défini ici dans la page employé
    if (
      !Number.isFinite(this.currentLat) ||
      !Number.isFinite(this.currentLng) ||
      !this.currentLat ||
      !this.currentLng
    ) {
      this.errorMessage =
        "Emplacement du travail non défini. Demandez d'abord à un administrateur de le définir.";
      this.withinRadius = null;
      this.presenceStatus = 'error';
      return;
    }

    if (
      !confirm(
        `Êtes-vous sûr de vouloir marquer votre présence pour aujourd'hui ?`
      )
    )
      return;

    this.isMarkingPresence = true;
    this.presenceStatus = 'locating';
    this.errorMessage = null;
    this.withinRadius = null;

    const { hour: cutH, minute: cutM } = this.getCutoffFor(new Date());
    const currentAttendance: 'P' | 'L' = this.time.isEmployeeOnTime(cutH, cutM)
      ? 'P'
      : 'L';

    try {
      // 1) Localisation robuste (augmente un peu le temps max en zone difficile)
      const pos = await this.compute.bestEffortGetLocation(20000);
      const { latitude, longitude, accuracy } = pos.coords;

      this.lastAccuracy = Math.round(accuracy);
      this.lastFixAt = new Date();

      // 2) Vérifie la distance avec marge = accuracy
      this.presenceStatus = 'checking';
      this.withinRadius = this.compute.checkWithinRadius(
        latitude,
        longitude,
        this.currentLat,
        this.currentLng,
        this.radius,
        accuracy
      );

      // Calcule la distance brute (info UI)
      this.lastDistance = Math.round(
        this.compute.calculateDistance(
          latitude,
          longitude,
          this.currentLat,
          this.currentLng
        )
      );

      if (!this.withinRadius) {
        // Pas d'alerte bloquante : on montre le panneau jaune avec détails
        this.presenceStatus = 'done';
        return;
      }

      // 3) Enregistre
      this.presenceStatus = 'saving';
      this.attendance = currentAttendance;
      await this.addAttendance(false);

      this.onTime = currentAttendance === 'P' ? "À l'heure" : 'En retard';
      this.presenceStatus = 'done';
      // (Optionnel) petite notif
      // alert('Présence enregistrée.');
    } catch (err: any) {
      this.errorMessage = err?.message || 'Localisation impossible.';
      this.withinRadius = null;
      this.presenceStatus = 'error';
    } finally {
      this.isMarkingPresence = false;
      this.checkGeoPermission();
    }
  }

  requestVacation() {
    if (!this.time.isValidRequestDateForVacation(this.requestDate)) {
      return;
    }
    if (this.vacation <= 0) {
      alert(
        "Vous n'avez plus de vacances disponibles. " +
          "Veuillez contacter votre superviseur ou attendre l'année prochaine."
      );
      return; // ⟵ On sort immédiatement
    }
    // Vacation in process
    this.attendance = 'VP';

    const formattedDate = this.formatDate(this.requestDate);

    // Check if the date is already requested
    if (
      this.employee.attendance &&
      this.employee.attendance[formattedDate] === 'VP'
    ) {
      alert('Cette date a déjà été demandée. Veuillez en choisir une autre.');
      return;
    }

    // Add the number of requests for vacation
    let vacationRequests =
      Number(this.employee.vacationRequestNumberOfDays) || 0;
    if (vacationRequests >= 8) {
      alert(
        "Vous avez déjà utilisé toutes vos vacances. Essayez l'année prochaine"
      );
      return;
    }

    vacationRequests += 1;
    this.employee.vacationRequestNumberOfDays = vacationRequests.toString();

    this.addAttendance(false, formattedDate);
    this.data.updateEmployeeNumberOfVacationRequest(
      vacationRequests.toString(),
      this.employee.uid!
    );

    this.toggle('showRequestVacation');
  }
  private formatDate(inputDate: string): string {
    const [year, month, day] = inputDate.split('-');
    const now = new Date();
    // const hours = now.getHours();

    // Trim leading zeros
    const trimmedMonth = month.replace(/^0/, '');
    const trimmedDay = day.replace(/^0/, '');

    // Return the formatted date
    return `${trimmedMonth}-${trimmedDay}-${year}`;
  }

  /** Called when user clicks "Attach/Change Receipt" button */
  attachReceipt(index: number) {
    // Save which index we are about to attach or replace
    this.currentReceiptIndex = index;

    // Programmatically open the hidden file input
    const fileInput = document.getElementById(
      'receiptFileInput'
    ) as HTMLInputElement;
    fileInput.click();
  }

  /** Called when user picks a file from the system file dialog */
  async onReceiptFileSelected(fileList: FileList) {
    const file = fileList?.item(0);
    if (!file) return;

    // Optionally, check file type, size, or convert HEIC to PNG
    if (
      !['image', 'application/pdf'].includes(file.type.split('/')[0]) &&
      file.type !== 'application/pdf'
    ) {
      // NEW condition
      alert('Seuls les fichiers image ou PDF sont acceptés');
      return;
    }

    if (file.size >= 5_000_000) {
      alert('Le fichier est trop grand (max 5MB).');
      return;
    }

    let fileToUpload = file;
    // Example: if you want to convert HEIC to PNG
    if (file.type === 'image/heic') {
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob: any = await heic2any({
          blob: file,
          toType: 'image/png',
          quality: 0.7,
        });
        fileToUpload = new File([convertedBlob], `${file.name}.png`, {
          type: 'image/png',
        });
      } catch (error) {
        console.error('Erreur de conversion HEIC -> PNG :', error);
        return;
      }
    }

    // Make sure we know which index we are updating
    if (this.currentReceiptIndex === null) {
      console.error('No currentReceiptIndex set. Cannot attach receipt.');
      return;
    }

    try {
      // e.g. "receipts/firstname-lastname-receipt{index}.png"
      const path = `receipts/${this.employee.firstName}-${this.employee.lastName}-receipt${this.currentReceiptIndex}`;

      // Upload to Firebase Storage
      const uploadTask = await this.storage.upload(path, fileToUpload);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Ensure receipts array is defined & large enough
      if (!this.employee.receipts) {
        this.employee.receipts = [];
      }
      // If the array is too short, fill up with empty strings
      while (this.employee.receipts.length <= this.currentReceiptIndex) {
        this.employee.receipts.push('');
      }

      // Insert or replace
      this.employee.receipts[this.currentReceiptIndex] = downloadURL;

      // Now update Firestore with the new `receipts` array
      await this.data.updateEmployeeReceiptsField(this.employee);
      alert('Reçu ajouté/modifié avec succès!');
    } catch (error) {
      console.error("Erreur d'upload :", error);
      alert("Impossible d'ajouter le reçu. Réessayez.");
    } finally {
      // Reset the index so we don't accidentally overwrite another payment
      this.currentReceiptIndex = null;
    }
  }
  /** Envoie le SMS à l'employé affiché */
  sendSMSCurrent(type: 'bonus' | 'paiement') {
    const callable = this.fns.httpsCallable('sendEmployeePayRemindersSMS');

    // empaqueter le salarié courant dans un tableau
    const payload = {
      type,
      employees: [
        {
          phoneNumber: this.employee.phoneNumber,
          // optionnel : firstName / signUrl si jamais votre message les utilise
          firstName: this.employee.firstName,
          lastName: this.employee.lastName,
        },
      ],
    };

    callable(payload).subscribe({
      next: (res: any) => alert(`SMS envoyé : ${res.sent}/1`),
      error: (err) => alert('Erreur SMS : ' + err.message),
    });
  }
  verifyCode() {
    if (this.code.trim() === this.paymentCode) {
      this.isAuthorized = true;
      this.errorMsg = '';
    } else {
      this.errorMsg = 'Code incorrect. Essayez encore';
      this.code = ''; // clear the field
    }
  }
  toggleOverlay(show: boolean) {
    if (show) this.code = ''; // reset when showing
  }

  /* ─── helper used by *ngFor ─────────────────────── */
  auditFiltered() {
    const list = this.auditReceipts.filter(
      (r) =>
        !this.auditSearch ||
        r.frenchDate.toLowerCase().includes(this.auditSearch.toLowerCase())
    );
    // Non-admin always sees only 2
    if (!this.auth.isAdmin) {
      return list.slice(0, 2);
    }
    // Admin sees 2 initially, all if expanded
    return this.showAllAuditReceipts ? list : list.slice(0, 2);
  }

  /* ─── upload new receipt ───────────────────────── */
  async auditUpload(files: FileList | null) {
    if (!this.auth.isAdmin || !files?.length) return;
    if (!this.auditNewAmount || this.auditNewAmount <= 0) {
      alert('Entrez un montant valide');
      return;
    }

    const file = files.item(0)!;
    const id = this.afs.createId();
    const path = `auditReceipts/${this.employee.uid}/${id}`;

    try {
      const up = await this.storage.upload(path, file);
      const url = await up.ref.getDownloadURL();
      await this.afs
        .doc(`users/${this.employee.uid}/auditReceipts/${id}`)
        .set({ url, ts: Date.now(), amount: Number(this.auditNewAmount) });
      this.auditNewAmount = null;
      alert('✅ Reçu ajouté'); // ← success toast
    } catch {
      alert('❌ Échec de l’envoi');
    }
  }

  /* ─── prepare file-replace ─────────────────────── */
  auditPrepareReplace(r: AuditReceipt) {
    this.auditSel = r.docId;
    this.auditFileInput.nativeElement.click();
  }

  /* ─── replace existing receipt ─────────────────── */
  async auditReplace(files: FileList | null) {
    if (!files?.length || !this.auditSel) return;
    const file = files.item(0)!;
    const path = `auditReceipts/${this.employee.uid}/${this.auditSel}`;
    try {
      const up = await this.storage.upload(path, file);
      const url = await up.ref.getDownloadURL();
      await this.afs
        .doc(`users/${this.employee.uid}/auditReceipts/${this.auditSel}`)
        .update({ url });
      alert('✅ Reçu mis à jour'); // ← success toast
    } catch {
      alert('❌ Impossible de remplacer');
    }
    this.auditSel = '';
    this.auditFileInput.nativeElement.value = '';
  }

  /* ─── inline amount edit ───────────────────────── */
  async auditUpdateAmount(r: AuditReceipt) {
    if (!r.amount || r.amount <= 0) {
      alert('Montant invalide');
      return;
    }
    await this.afs
      .doc(`users/${this.employee.uid}/auditReceipts/${r.docId}`)
      .update({ amount: Number(r.amount) });
    alert('✅ Montant mis à jour'); // ← success toast
  }

  private async checkGeoPermission() {
    try {
      const nav: any = navigator as any;
      if (!nav.permissions || !nav.permissions.query) {
        this.geoStatus = 'unknown';
        return;
      }
      const status = await nav.permissions.query({
        name: 'geolocation' as PermissionName,
      });
      this.geoStatus = (status.state as any) ?? 'unknown';
      status.onchange = () =>
        (this.geoStatus = (status.state as any) ?? 'unknown');
    } catch {
      this.geoStatus = 'unknown';
    }
  }

  async warmUpGps() {
    if (this.warmingUp) return;
    this.warmingUp = true;
    this.errorMessage = null;
    try {
      // Regarde ~10s pour améliorer la précision avant un marquage
      await this.compute.bestEffortGetLocation(10000);
    } catch (e: any) {
      // best-effort : pas bloquant
      this.errorMessage = e?.message || null;
    } finally {
      this.warmingUp = false;
      this.checkGeoPermission();
    }
  }

  /* ─── 3.  Clic sur la cellule → ouvrir le modal ──────────────── */
  private onAttendanceCellClick(
    dateKey: string,
    curr: string | undefined,
    mode: 'admin' | 'employee' = 'admin'
  ) {
    const normalizedLabel = this.normalizeLabel(dateKey);
    if (mode === 'admin' && !this.auth.isAdmninistrator) {
      return;
    }
    if (mode === 'employee' && this.isFutureKinDateLabel(normalizedLabel)) {
      return;
    }
    this.statePickerMode = mode;
    this.activePickerStates =
      mode === 'admin' ? this.pickerStates : this.employeePickerStates;
    this.statePickerKey = dateKey;
    this.statePickerCurr = curr;
    this.selectedState =
      mode === 'employee'
        ? 'V'
        : (curr as AttendanceStateCode | undefined) ?? '';
    this.showStatePickerModal = true;
  }

  public closeAttachmentViewer() {
    this.attachmentViewer = {
      open: false,
      url: '',
      kind: '' as any,
      dateLabel: '',
      takenAt: null,
      takenAtSource: '',
      deviceLabel: '', // 👈 NEW
      photoHash: '' as string | undefined, // 👈 NEW
    };
  }
  compactDevice(dev: any): string {
    if (!dev) return '';
    const make = (dev.make || '').toString().trim();
    const model = (dev.model || '').toString().trim();
    // Common vendors sometimes put brand in model; this keeps it short and nice.
    const label = [make, model].filter(Boolean).join(' ');
    return label || 'Appareil';
  }

  private buildDeviceLabel(device?: any, ua?: any): string {
    const make = device?.make?.toString().trim();
    const model = device?.model?.toString().trim();
    if (make || model) return [make, model].filter(Boolean).join(' ');
    return ua?.platform || '';
  }

  // 🔧 REPLACE your current method with this:
  private openAttachmentViewer(att: any, dateLabel: string) {
    const ct = (att?.contentType || '').toString();
    const isImage = ct.startsWith('image/');
    const isVideo = ct.startsWith('video/');
    if (!isImage && !isVideo) return;

    const takenAtDate =
      this.coerceToDate(att?.takenAt) ||
      this.coerceToDate(att?.createdAt) ||
      this.coerceToDate(att?.uploadedAt) ||
      null;

    // Map any non-union source into the allowed set
    const proposedSource =
      (att?.takenAtSource as string) ||
      (att?.createdAt
        ? 'fileLastModified'
        : att?.uploadedAt
        ? 'storageUploadedAt'
        : 'unknown');

    const allowed = new Set([
      'exif',
      'fileLastModified',
      'storageUploadedAt',
      'unknown',
      '',
    ]);
    const normalizedSource = allowed.has(proposedSource)
      ? proposedSource
      : 'unknown';

    this.attachmentViewer = {
      open: true,
      url: att.url,
      kind: isImage ? 'image' : 'video',
      dateLabel,
      takenAt: takenAtDate,
      takenAtSource: normalizedSource as
        | 'exif'
        | 'fileLastModified'
        | 'storageUploadedAt'
        | 'unknown'
        | '',
      // ✅ include the new fields so the object matches the type
      deviceLabel: this.buildDeviceLabel(att?.device, att?.ua),
      photoHash: att?.photoHash || '',
    };

    // Fallback to Storage upload time if still missing
    if (!this.attachmentViewer.takenAt && att?.url) {
      this.storageUploadedAt(att.url).then((d: Date | null) => {
        if (d && !this.attachmentViewer.takenAt) {
          this.attachmentViewer.takenAt = d;
          this.attachmentViewer.takenAtSource = 'storageUploadedAt';
        }
      });
    }
  }

  // Helper to build ISO range for Firestore query
  private monthIsoRange(month: number, year: number) {
    const m = String(month).padStart(2, '0');
    const startISO = `${year}-${m}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endISO = `${year}-${m}-${String(daysInMonth).padStart(2, '0')}`;
    return { startISO, endISO };
  }

  private async loadMonthAttendanceAttachments(month: number, year: number) {
    this.monthAttachmentsByLabel = {};

    const userId = this.auth.currentUser?.uid; // your current choice
    const employeeId = this.employee?.uid;
    if (!userId || !employeeId) return;

    const { startISO, endISO } = this.monthIsoRange(month, year);

    const attendanceColl = this.afs.collection(
      `users/${userId}/employees/${employeeId}/attendance`,
      (ref) =>
        ref.where('dateISO', '>=', startISO).where('dateISO', '<=', endISO)
    );

    const monthSnap = await firstValueFrom(attendanceColl.get());
    const tasks = monthSnap.docs.map(async (dayDoc) => {
      const d = dayDoc.data() as any;
      const label = this.normalizeLabel(d?.dateLabel, d?.dateISO);
      if (!label) return;

      const attColl = this.afs.collection(
        `users/${userId}/employees/${employeeId}/attendance/${dayDoc.id}/attachments`,
        (ref) => ref.orderBy('uploadedAt', 'desc') // works with numeric uploadedAt
      );
      const attSnap = await firstValueFrom(attColl.get());
      // let atts = attSnap.docs.map((s) => s.data());
      const atts = attSnap.docs
        .map((s) => s.data() as any)
        .sort((a, b) => {
          const ta = typeof a.takenAt === 'number' ? a.takenAt : -Infinity;
          const tb = typeof b.takenAt === 'number' ? b.takenAt : -Infinity;
          const ua = this.ts(a.uploadedAt);
          const ub = this.ts(b.uploadedAt);
          // Prefer takenAt; if missing, fall back to uploadedAt
          return (tb !== -Infinity ? tb : ub) - (ta !== -Infinity ? ta : ua);
        });

      if (!atts.length) return;

      if (!this.monthAttachmentsByLabel[label]) {
        this.monthAttachmentsByLabel[label] = [];
      }
      this.monthAttachmentsByLabel[label].push(...atts);
    });

    await Promise.all(tasks);
  }

  /** Normalize any of:
   * "8-12-2025"                -> "8-12-2025"
   * "8-12-2025-11-56-21"       -> "8-12-2025"
   * and if missing, use dateISO "2025-08-12" -> "8-12-2025"
   */
  private normalizeLabel(dateLabel?: string, dateISO?: string): string {
    if (dateLabel) {
      const p = dateLabel.split('-');
      if (p.length >= 3) return `${+p[0]}-${+p[1]}-${p[2]}`;
    }
    if (dateISO) {
      const [y, m, d] = dateISO.split('-').map(Number);
      return `${m}-${d}-${y}`;
    }
    return '';
  }
  private pickLatestAttachment(list: any[]) {
    return list.slice().sort((a, b) => {
      const ta = typeof a.takenAt === 'number' ? a.takenAt : -Infinity;
      const tb = typeof b.takenAt === 'number' ? b.takenAt : -Infinity;
      const ua = this.ts(a.uploadedAt);
      const ub = this.ts(b.uploadedAt);
      return (tb !== -Infinity ? tb : ub) - (ta !== -Infinity ? ta : ua);
    })[0];
  }

  private labelToDateParts(
    label: string
  ): { y: number; m: number; d: number } | null {
    if (!label) return null;
    const parts = label.split('-');
    if (parts.length < 3) return null;
    const m = Number(parts[0]);
    const d = Number(parts[1]);
    const y = Number(parts[2]);
    if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) {
      return null;
    }
    return { y, m, d };
  }

  private isFutureKinDateLabel(label: string): boolean {
    const parts = this.labelToDateParts(label);
    if (!parts) return false;
    const today = this.kinParts(new Date());
    if (parts.y !== today.y) return parts.y > today.y;
    if (parts.m !== today.m) return parts.m > today.m;
    return parts.d > today.d;
  }

  private findAttachmentForDay(dateLabel: string) {
    // 1) subcollection cache
    const list = this.monthAttachmentsByLabel[dateLabel];
    if (list?.length) return this.pickLatestAttachment(list);

    // 2) legacy fallback (your existing code below) ...
    const legacy = (this.employee as any)?.attendanceAttachments || {};
    const keys = Object.keys(legacy).filter((k) => k.startsWith(dateLabel));
    if (!keys.length) return null;
    const bestKey = keys.reduce((p, c) => {
      const P = p.split('-'),
        C = c.split('-');
      const tp = (+P[3] || 0) * 3600 + (+P[4] || 0) * 60 + (+P[5] || 0);
      const tc = (+C[3] || 0) * 3600 + (+C[4] || 0) * 60 + (+C[5] || 0);
      return tc > tp ? c : p;
    });
    return legacy[bestKey];
  }
  onAttachmentSelected(em: any, evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    em._attachmentError = '';
    em._attachmentFile = null;
    em._attachmentPreview = null;
    em._attachmentType = null;
    em._attachmentSize = null;
    em._attachmentTakenAt = null;
    em._attachmentTakenAtSource = '';

    if (!file) return;

    // validate type/size (existing code)
    const isOkType =
      file.type.startsWith('image/') || file.type.startsWith('video/');
    const maxBytes = 10 * 1024 * 1024;
    if (!isOkType) {
      em._attachmentError = 'Seuls les fichiers image ou vidéo sont autorisés.';
      return;
    }
    if (file.size > maxBytes) {
      em._attachmentError = 'Fichier trop volumineux (max 10 Mo).';
      return;
    }

    // keep file + preview
    em._attachmentFile = file;
    em._attachmentType = file.type;
    em._attachmentSize = file.size;

    const reader = new FileReader();
    reader.onload = () => (em._attachmentPreview = reader.result as string);
    reader.readAsDataURL(file);

    // NEW: read original capture date for preview
    this.readFirstCreated(file).then((info) => {
      em._attachmentTakenAt = info.date;
      em._attachmentTakenAtSource = info.source;
    });
  }

  /** Try to read the original capture/creation date from EXIF/QuickTime.
   *  Falls back to the file's lastModified when EXIF isn't present. */
  private async readFirstCreated(file: File): Promise<{
    date: Date | null;
    source:
      | 'exif'
      | 'filename'
      | 'mp4-mvhd'
      | 'mp4-mdhd'
      | 'fileLastModified'
      | 'storageUploadedAt'
      | 'unknown';
  }> {
    // 1) Try EXIF / QuickTime metadata via exifr
    try {
      const tags: any = await exifr.parse(file);
      const candidates: (Date | undefined)[] = [
        tags?.DateTimeOriginal,
        tags?.CreateDate,
        tags?.MediaCreateDate,
        tags?.TrackCreateDate,
        tags?.ModifyDate,
      ];
      const valid = candidates.filter(
        (d): d is Date => d instanceof Date && !isNaN(d.getTime())
      );
      if (valid.length) {
        const earliest = valid.reduce((a, b) =>
          a.getTime() <= b.getTime() ? a : b
        );
        return { date: earliest, source: 'exif' };
      }
    } catch {
      /* ignore */
    }

    // 2) Filename heuristics (very common on Android)
    const fromName = this.parseTakenAtFromFilename(file.name);
    if (fromName) return { date: fromName, source: 'filename' };

    // 3) MP4 container (mvhd/mdhd). Read small chunk only; good last resort.
    if (file.type.startsWith('video/')) {
      const mp4 = await this.parseMp4CreationTime(file);
      if (mp4.date) return mp4;
    }

    // 4) Fallback: file system timestamp (often "now" on Android galleries)
    if (file.lastModified)
      return { date: new Date(file.lastModified), source: 'fileLastModified' };

    return { date: null, source: 'unknown' };
  }

  /** For older attachments that don’t have EXIF saved yet, use Storage upload time */
  private async storageUploadedAt(url: string): Promise<Date | null> {
    try {
      const meta = await this.storage.storage.refFromURL(url).getMetadata();
      return meta?.timeCreated ? new Date(meta.timeCreated) : null;
    } catch {
      return null;
    }
  }
  // Put this near your other helpers
  private ts(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Date.parse(v);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  /** Try common Android/Gallery filename patterns to recover the timestamp. */
  private parseTakenAtFromFilename(name: string): Date | null {
    const n = name;

    const pats: RegExp[] = [
      // VID_YYYYMMDD_HHMMSS.mp4   (Samsung, many Android)
      /VID[_-]?(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/i,
      // PXL_YYYYMMDD_HHMMSS.*.MP4 (Google Camera / Pixel)
      /PXL[_-]?(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/i,
      // WhatsApp Video 2024-06-01 at 12.34.56.mp4
      /WhatsApp\s+Video\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{2})\.(\d{2})\.(\d{2})/i,
      // Generic YYYYMMDD_HHMMSS
      /(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/,
    ];

    for (const rx of pats) {
      const m = n.match(rx);
      if (m) {
        const [, y, mo, d, h, mi, s] = m;
        const dt = new Date(
          Number(y),
          Number(mo) - 1,
          Number(d),
          Number(h),
          Number(mi),
          Number(s)
        );
        if (Number.isFinite(+dt)) return dt;
      }
    }
    return null;
  }

  /** Optional: light MP4 parser to read creation time from mvhd/mdhd (seconds since 1904-01-01 UTC). */
  private async parseMp4CreationTime(file: File): Promise<{
    date: Date | null;
    source: 'mp4-mvhd' | 'mp4-mdhd' | 'unknown';
  }> {
    try {
      // Read only the first few MB to keep it snappy; most phones place 'moov' up front.
      const CHUNK = Math.min(file.size, 2 * 1024 * 1024);
      const buf = await file.slice(0, CHUNK).arrayBuffer();
      const data = new DataView(buf);
      const len = data.byteLength;
      let offset = 0;
      const MP4_EPOCH = Math.floor(Date.UTC(1904, 0, 1) / 1000);

      const u32 = (o: number) => data.getUint32(o);
      const u64 = (o: number) =>
        data.getUint32(o) * 2 ** 32 + data.getUint32(o + 4);
      const typeAt = (o: number) =>
        String.fromCharCode(
          data.getUint8(o + 4),
          data.getUint8(o + 5),
          data.getUint8(o + 6),
          data.getUint8(o + 7)
        );

      while (offset + 8 <= len) {
        const size = u32(offset);
        if (!size || size < 8) break;
        const type = typeAt(offset);

        if (type === 'mvhd' || type === 'mdhd') {
          const boxStart = offset + 8;
          const version = data.getUint8(boxStart);
          let secs: number;
          if (version === 1) {
            // creation_time is 8 bytes at boxStart+4
            secs = Number(u64(boxStart + 4)) - MP4_EPOCH;
          } else {
            // version 0: creation_time is 4 bytes at boxStart+4
            secs = u32(boxStart + 4) - MP4_EPOCH;
          }
          if (secs > 0 && secs < 1e12) {
            return {
              date: new Date(secs * 1000),
              source: type === 'mvhd' ? 'mp4-mvhd' : 'mp4-mdhd',
            };
          }
        }

        offset += size; // jump to next box
      }
    } catch {
      // ignore
    }
    return { date: null, source: 'unknown' };
  }
  private coerceToDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date && !isNaN(+v)) return v;

    if (typeof v === 'number') {
      // handle seconds vs milliseconds
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      return isNaN(+d) ? null : d;
    }

    if (typeof v === 'string') {
      const n = Date.parse(v);
      return Number.isFinite(n) ? new Date(n) : null;
    }

    // Firestore Timestamp (both compat and mod SDKs expose .toDate())
    if (v && typeof v.toDate === 'function') {
      try {
        const d = v.toDate();
        return d instanceof Date && !isNaN(+d) ? d : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  formatKinshasa(val: any, locale = 'fr'): string {
    const d = this.coerceToDate(val);
    if (!d) return ''; // keep empty so your UI shows only the label

    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'Africa/Kinshasa',
      }).format(d);
    } catch {
      // Fallback for rare environments lacking the IANA zone:
      // show Kinshasa by formatting UTC after adding +1h
      const plus1h = new Date(d.getTime() + 60 * 60 * 1000);
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC',
      }).format(plus1h);
    }
  }

  /** Turn a Date into Kinshasa local parts */
  private kinParts(d: Date) {
    const fmt = new Intl.DateTimeFormat('fr-CD', {
      timeZone: 'Africa/Kinshasa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const map: any = {};
    fmt.forEach((p) => (map[p.type] = p.value));
    return {
      y: Number(map.year),
      m: Number(map.month),
      d: Number(map.day),
      hh: Number(map.hour),
      mm: Number(map.minute),
      ss: Number(map.second),
    };
  }

  private sameKinDay(a: Date, b: Date): boolean {
    const A = this.kinParts(a),
      B = this.kinParts(b);
    return A.y === B.y && A.m === B.m && A.d === B.d;
  }

  /** Build your "M-D-YYYY-HH-mm-ss" label from Kinshasa local time */
  private kinLabelFromDate(d: Date): string {
    const p = this.kinParts(d);
    const M = String(p.m); // no leading zero as in your keys
    const D = String(p.d);
    const Y = String(p.y);
    const HH = String(p.hh).padStart(2, '0');
    const MM = String(p.mm).padStart(2, '0');
    const SS = String(p.ss).padStart(2, '0');
    return `${M}-${D}-${Y}-${HH}-${MM}-${SS}`;
  }

  /** Core rule:
   *  - same Kinshasa day & time <= 09:05 → 'P'
   *  - same Kinshasa day & time  > 09:05 → 'L'
   *  - any other day (past/future)       → 'F'
   */
  computeAttendanceFromPhoto(
    takenAt: Date | null,
    targetDay: Date = this.attendanceTargetDate
  ): 'P' | 'L' | 'F' | '' {
    if (!takenAt) return '';
    const reference = targetDay ? new Date(targetDay.getTime()) : new Date();
    if (!this.sameKinDay(takenAt, reference)) return 'F';

    const { hour: H, minute: M } = this.getCutoffFor(reference);
    const p = this.kinParts(takenAt); // expects p.hh / p.mm in Kinshasa time
    if (p.hh < H) return 'P';
    if (p.hh > H) return 'L';
    return p.mm <= M ? 'P' : 'L';
  }

  async confirmPhotoAttendance(employee: any) {
    if (!employee._attachmentFile) {
      alert("Ajoutez d'abord une photo (obligatoire).");
      return;
    }

    const when: Date | null = employee._attachmentTakenAt || null;
    if (!when) {
      alert(
        'Impossible de lire la date de la photo (EXIF/dern. modif). Réessayez.'
      );
      return;
    }

    const targetDay =
      this.attendanceTargetDate ||
      this.resolveAttendanceTargetDate(this.attendanceMode);
    const status = this.computeAttendanceFromPhoto(when, targetDay);
    if (!status) {
      alert('Statut non déterminé. Ajoutez une photo valide.');
      return;
    }

    this.attendance = status; // used by your pipeline
    const label =
      this.attendanceMode === 'today'
        ? ''
        : this.buildLabelForTarget(targetDay, when);
    await this.addAttendanceForEmployee(employee, status, label, targetDay);
  }

  /** Kinshasa-localized Date from a UTC/Local Date */
  private kinDate(d: Date): Date {
    return new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Kinshasa' }));
  }

  /** Saturday in Kinshasa? (0=Sun…6=Sat) */
  private isKinSaturday(d: Date): boolean {
    return this.kinDate(d).getDay() === 6;
  }

  /** Returns the cutoff (hour, minute) for a given Kinshasa day */
  private getCutoffFor(d: Date): { hour: number; minute: number } {
    // added the new set time for the employee for a particularone.
    let lH = Number(this.employee.arrivalHour) || this.limitHour;
    let lM = Number(this.employee.arrivalMinute) || this.limitMinutes;
    return this.isKinSaturday(d)
      ? { hour: 11, minute: 5 }
      : { hour: lH, minute: lM };
  }

  /** Label for today's cutoff in Kinshasa (e.g., "09:05" or "11:05" on Saturday) */
  get todayCutoffLabel(): string {
    const { hour, minute } = this.getCutoffFor(new Date());
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** Persist a soft, per-browser device id (clears if user wipes storage). */
  private ensureSoftDeviceId(): string {
    const KEY = 'fg_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      // crypto.randomUUID() supported in modern browsers
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  /** User-agent info without permissions (falls back on navigator.userAgent). */
  private getUaInfo() {
    const nav: any = navigator as any;
    // UA-CH if available
    const uaData = nav.userAgentData || null;
    return {
      // High-level hints
      brands: uaData?.brands || null,
      mobile: uaData?.mobile ?? null,
      platform: uaData?.platform || null,

      // Legacy UA fallback
      ua: navigator.userAgent,

      // Some extra non-identifying signals
      language: navigator.language,
      screen: {
        w: window.screen?.width,
        h: window.screen?.height,
        dpr: window.devicePixelRatio || 1,
      },
    };
  }

  /** Read useful EXIF fields from an image file. */
  private async readExifDeviceInfo(file: File) {
    try {
      const tags = await (exifr as any).parse(file, {
        pick: [
          'Make',
          'Model',
          'Software',
          'ImageUniqueID',
          'BodySerialNumber',
          'LensModel',
          'CreateDate',
          'DateTimeOriginal',
        ],
      });
      return {
        make: tags?.Make || null,
        model: tags?.Model || null,
        software: tags?.Software || null,
        imageUniqueId: tags?.ImageUniqueID || null, // often missing
        serial: tags?.BodySerialNumber || null, // almost always missing
        lens: tags?.LensModel || null,
      };
    } catch (e) {
      console.warn('EXIF parse failed', e);
      return null;
    }
  }

  /** SHA-256 of the file (detects re-uploads/reuse; not perceptual). */
  private async hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ─── Appliquer le choix du modal ────────────────────────────── */
  async applySelectedAttendanceState() {
    if (!this.statePickerKey) {
      return;
    }

    if (this.statePickerMode === 'admin') {
      if (!this.auth.isAdmninistrator) {
        return;
      }
      const key = this.statePickerKey;
      const choice = this.selectedState; // '' means "empty" → delete
      const newAtt = { ...(this.employee.attendance ?? {}) };

      if (!choice) {
        if (newAtt[key] !== undefined) delete newAtt[key];
      } else {
        newAtt[key] = choice;
      }

      try {
        await this.data.updateEmployeeAttendance(newAtt, this.employee.uid!);
        this.employee.attendance = newAtt;
        this.generateAttendanceTable(this.givenMonth, this.givenYear);
      } catch (e) {
        alert('❌ Impossible de mettre à jour la présence');
        console.error(e);
      } finally {
        this.closeStatePicker();
      }
      return;
    }

    if (this.auth.isAdmninistrator) {
      return;
    }

    const normalizedLabel = this.normalizeLabel(this.statePickerKey);
    if (this.hasAttendanceForLabel(normalizedLabel)) {
      alert('Cette journée est déjà renseignée.');
      this.closeStatePicker();
      return;
    }
    if (this.isFutureKinDateLabel(normalizedLabel)) {
      this.closeStatePicker();
      return;
    }

    if (this.selectedState !== 'V') {
      alert("Option non autorisée pour l'employé.");
      return;
    }

    const employeeId = this.employee?.uid;
    if (!employeeId) {
      alert("Impossible d'identifier l'employé pour cette action.");
      return;
    }

    const acceptedVacations =
      Number(this.employee.vacationAcceptedNumberOfDays) || 0;
    const remainingDays = this.TOTAL_VACATION_DAYS - acceptedVacations;
    if (remainingDays <= 0) {
      alert(
        "Vous n'avez plus de jours de vacances disponibles pour cette période."
      );
      this.closeStatePicker();
      return;
    }

    const confirmed = confirm(
      'Confirmez-vous vouloir marquer cette journée comme vacances ? Seul un administrateur pourra modifier ce choix.'
    );
    if (!confirmed) {
      return;
    }

    const newAtt = { ...(this.employee.attendance ?? {}) };
    newAtt[normalizedLabel] = 'V';
    const updatedAccepted = acceptedVacations + 1;

    try {
      await this.data.updateEmployeeAttendance(newAtt, employeeId);
      await this.data.updateEmployeeNumberOfAcceptedVacation(
        updatedAccepted.toString(),
        employeeId
      );
      this.employee.attendance = newAtt;
      this.employee.vacationAcceptedNumberOfDays = updatedAccepted.toString();
      this.vacation = Math.max(0, this.TOTAL_VACATION_DAYS - updatedAccepted);
      this.generateAttendanceTable(this.givenMonth, this.givenYear);
    } catch (e) {
      alert('❌ Impossible de marquer cette journée comme vacances.');
      console.error(e);
    } finally {
      this.closeStatePicker();
    }
  }

  /* ─── Supprimer explicitement l’état courant ─────────────────── */
  async deleteAttendanceStateForKey() {
    if (!this.auth.isAdmninistrator || !this.statePickerKey) return;

    const key = this.statePickerKey;
    const newAtt = { ...(this.employee.attendance ?? {}) };
    if (newAtt[key] === undefined) {
      this.closeStatePicker();
      return;
    }

    try {
      //  delete this.employee.attendance[date];
      delete newAtt[key];
      this.data.updateEmployeeAttendanceRejection(newAtt, this.employee.uid!);
      // await this.data.updateEmployeeAttendance(newAtt, this.employee.uid!);
      this.employee.attendance = newAtt;
      this.generateAttendanceTable(this.givenMonth, this.givenYear);
    } catch (e) {
      alert('❌ Impossible de supprimer cet état');
      console.error(e);
    } finally {
      this.closeStatePicker();
    }
  }

  public closeStatePicker() {
    this.showStatePickerModal = false;
    this.statePickerKey = '';
    this.statePickerCurr = undefined;
    this.selectedState = '';
    this.statePickerMode = 'admin';
    this.activePickerStates = this.pickerStates;
  }

  private mmKey(y: number, m: number) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  private rgbaFromRgb(rgb: string, alpha = 0.88) {
    // "rgb(255, 0, 0)" -> "rgba(255, 0, 0, 0.88)"
    return rgb.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }

  private async loadDayTotalsForMonth(
    month: number,
    year: number
  ): Promise<void> {
    this.monthlyDayTotals = {};
    const ownerUid = this.auth.currentUser?.uid;
    const empUid = this.employee?.uid;
    if (!ownerUid || !empUid) return;

    const monthKey = this.mmKey(year, month);
    // Query only this month (thanks to monthKey in your CF)
    const col = this.afs.collection(
      `users/${ownerUid}/employees/${empUid}/dayTotals`,
      (ref) => ref.where('monthKey', '==', monthKey)
    );

    const snap = await firstValueFrom(col.get());
    snap.forEach((doc) => {
      const d: any = doc.data();
      const expected = Number(d?.expected || 0);
      const total = Number(
        d?.total ??
          d?.collected ?? // fallback if you choose a different field name
          d?.paid ??
          0
      );
      this.monthlyDayTotals[doc.id] = { expected, total };
    });
  }

  generateCollectionsTable(month: number, year: number) {
    const body = document.getElementById('collections-body');
    if (!body) return;

    body.innerHTML = '';

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();

    let date = 1;
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('tr');

      for (let j = 0; j < 7; j++) {
        const cell = document.createElement('td');

        if (i === 0 && j < firstDayIndex) {
          cell.classList.add('not-filled');
          cell.innerHTML = '';
        } else if (date > daysInMonth) {
          cell.classList.add('bg-gray-200', 'p-16');
          cell.innerHTML = '';
        } else {
          const dayKey = `${month}-${date}-${year}`;
          const rec = this.monthlyDayTotals[dayKey];

          cell.classList.add('border', 'border-black', 'p-4', 'text-center');

          if (rec && rec.expected > 0) {
            const pct = Math.max(
              0,
              Math.min(100, Math.round((rec.total / rec.expected) * 100))
            );
            const color = this.compute.getGradientColor(pct);
            cell.style.backgroundColor = this.rgbaFromRgb(color, 0.9);
            cell.style.color = '#fff';
            cell.innerHTML = `${date}<br>${pct}%`;
            cell.title = `Total: ${rec.total.toLocaleString()} • Attendu: ${rec.expected.toLocaleString()}`;
          } else if (rec && rec.expected === 0) {
            cell.classList.add('bg-slate-200');
            cell.innerHTML = `${date}<br>—`;
            cell.title = 'Attendu: 0';
          } else {
            // no data for that day
            cell.innerHTML = `${date}`;
          }
          if (this.auth.isAdmninistrator) {
            cell.classList.add('cursor-pointer');
            const dayKey = `${month}-${date}-${year}`;
            cell.addEventListener('click', () =>
              this.openCollectionsEditor(dayKey)
            );
          }

          date++;
        }

        row.appendChild(cell);
      }

      body.appendChild(row);
      if (date > daysInMonth) break;
    }
  }

  // OPEN the editor for a given day
  openCollectionsEditor(dayKey: string) {
    if (!this.auth.isAdmninistrator) return;
    this.editorDayKey = dayKey;
    const rec: any = this.monthlyDayTotals?.[dayKey] || {};
    // if 0 or missing → show empty
    this.editorExpected =
      rec?.expected && Number(rec.expected) > 0 ? String(rec.expected) : '';
    this.editorTotal =
      rec?.total && Number(rec.total) > 0 ? String(rec.total) : '';
    this.editorErr = '';
    this.showCollectionsEditor = true;
  }

  private pathForDayTotal(ownerUid: string, empUid: string, dayKey: string) {
    return `users/${ownerUid}/employees/${empUid}/dayTotals/${dayKey}`;
  }

  // SAVE (set / clear fields)
  async saveCollectionsEditor() {
    if (!this.auth.isAdmninistrator) return;
    const ownerUid = this.auth.currentUser?.uid;
    const empUid = this.employee?.uid;
    if (!ownerUid || !empUid || !this.editorDayKey) return;

    this.editorBusy = true;
    this.editorErr = '';
    try {
      const [mStr, , yStr] = this.editorDayKey.split('-');
      const monthKey = this.mmKey(Number(yStr), Number(mStr));
      const docRef = this.afs.doc(
        `users/${ownerUid}/employees/${empUid}/dayTotals/${this.editorDayKey}`
      );

      // 👇 Normalize to strings so trim() is always safe
      const expectedStr = String(this.editorExpected ?? '').trim();
      const totalStr = String(this.editorTotal ?? '').trim();

      const setData: any = { monthKey };
      const deletes: string[] = [];

      if (expectedStr === '') {
        deletes.push('expected');
      } else {
        const n = Number(expectedStr);
        if (Number.isNaN(n) || n < 0) throw new Error('Attendu invalide');
        setData.expected = n;
      }

      if (totalStr === '') {
        deletes.push('total');
      } else {
        const n = Number(totalStr);
        if (Number.isNaN(n) || n < 0) throw new Error('Total invalide');
        setData.total = n;
      }

      await docRef.set(setData, { merge: true });

      if (deletes.length) {
        const delPayload: any = {};
        deletes.forEach(
          (f) => (delPayload[f] = firebase.firestore.FieldValue.delete())
        );
        await docRef.update(delPayload).catch(() => {});
      }

      await this.loadDayTotalsForMonth(this.givenMonth, this.givenYear);
      this.generateCollectionsTable(this.givenMonth, this.givenYear);
      this.showCollectionsEditor = false;
    } catch (e: any) {
      this.editorErr = e?.message || String(e);
    } finally {
      this.editorBusy = false;
    }
  }

  // QUICK helpers
  async clearExpectedOnly() {
    this.editorExpected = '';
    await this.saveCollectionsEditor();
  }
  async clearTotalOnly() {
    this.editorTotal = '';
    await this.saveCollectionsEditor();
  }

  // DELETE entire doc (table shows plain date = “empty”)
  async deleteCollectionsRecord() {
    if (!this.auth.isAdmninistrator) return;
    const ok = confirm('Supprimer entièrement cet enregistrement ?');
    if (!ok) return;

    const ownerUid = this.auth.currentUser?.uid;
    const empUid = this.employee?.uid;
    if (!ownerUid || !empUid || !this.editorDayKey) return;

    this.editorBusy = true;
    this.editorErr = '';
    try {
      await this.afs
        .doc(this.pathForDayTotal(ownerUid, empUid, this.editorDayKey))
        .delete();
      delete this.monthlyDayTotals[this.editorDayKey];
      this.generateCollectionsTable(this.givenMonth, this.givenYear);
      this.showCollectionsEditor = false;
    } catch (e: any) {
      this.editorErr = e?.message || String(e);
    } finally {
      this.editorBusy = false;
    }
  }

  // === Ring geometry ===
  size = 220; // overall SVG size (px)
  strokeWidth = 16;

  get radius2() {
    return (this.size - this.strokeWidth) / 2;
  }
  get center() {
    return this.size / 2;
  }
  get circumference() {
    return 2 * Math.PI * this.radius2;
  }

  // Use your computed month % (string) -> number
  get avgPerf(): number {
    return Number(this.performancePercentageMonth) || 0;
  }

  // Unique-ish gradient id per month/year
  get gradId(): string {
    return `perfGrad-${this.givenYear}-${this.givenMonth}`;
  }

  // 0..100 -> stroke dasharray "drawn blank"
  progressDasharray(): string {
    const drawn = (this.avgPerf / 100) * this.circumference;
    return `${drawn} ${this.circumference}`;
  }

  // Use your existing gradient color util for consistency
  colorForPerf(n: number): string {
    return this.compute.getGradientColor(n); // returns e.g. "rgb(…)"
  }

  // 36 ticks from -90° baseline every 10% (i.e., 0..100 step 10 -> 11 ticks)
  ticks: number[] = Array.from({ length: 11 }, (_, i) => i * 36); // 360° * 10% = 36°

  /**
   * Check if employee has best team trophies
   */
  hasBestTeamTrophy(): boolean {
    return !!(
      this.employee.bestTeamTrophies &&
      this.employee.bestTeamTrophies.length > 0
    );
  }

  /**
   * Check if employee has best employee trophies
   */
  hasBestEmployeeTrophy(): boolean {
    return !!(
      this.employee.bestEmployeeTrophies &&
      this.employee.bestEmployeeTrophies.length > 0
    );
  }

  /**
   * Get formatted trophy date string
   */
  getTrophyDate(trophy: Trophy): string {
    if (!trophy || !trophy.month || !trophy.year) return '';
    const monthNames = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const monthIndex = parseInt(trophy.month, 10) - 1;
    const monthName =
      monthIndex >= 0 && monthIndex < 12
        ? monthNames[monthIndex]
        : trophy.month;
    return `${monthName} ${trophy.year}`;
  }

  /**
   * Get all team trophies for an employee
   */
  getTeamTrophies(): Trophy[] {
    return this.employee.bestTeamTrophies || [];
  }

  /**
   * Get all employee trophies for an employee
   */
  getEmployeeTrophies(): Trophy[] {
    return this.employee.bestEmployeeTrophies || [];
  }

  /**
   * Open trophy modal
   */
  openTrophyModal(type: 'team' | 'employee'): void {
    this.trophyModalType = type;
    this.trophyModalVisible = true;
  }

  /**
   * Close trophy modal
   */
  closeTrophyModal(): void {
    this.trophyModalVisible = false;
    this.trophyModalType = null;
  }

  /**
   * Get trophies for modal display
   */
  getModalTrophies(): Trophy[] {
    if (!this.trophyModalType) return [];
    return this.trophyModalType === 'team'
      ? this.employee.bestTeamTrophies || []
      : this.employee.bestEmployeeTrophies || [];
  }

  /**
   * Get modal title
   */
  getModalTitle(): string {
    if (!this.trophyModalType) return '';
    return this.trophyModalType === 'team'
      ? 'Trophées Meilleure Équipe'
      : 'Trophées Meilleur Employé';
  }
}
