import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { User } from 'src/app/models/user';
import { Client } from 'src/app/models/client';
import { Card } from 'src/app/models/card';
import { DataService } from 'src/app/services/data.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-gestion-day',
  templateUrl: './gestion-day.component.html',
  styleUrls: ['./gestion-day.component.css'],
})
export class GestionDayComponent implements OnInit {
  size = 220;
  strokeWidth = 16;
  avgPerf = 0; // 0..100
  gradId = 'perfGrad-' + Math.random().toString(36).slice(2);
  managementInfo?: Management = {};
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService,
    private afs: AngularFirestore
  ) {}
  ngOnInit(): void {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.initalizeInputs();
      this.updateReserveGraphics(this.graphicsRange);
      this.updateServeGraphics(this.graphicsRangeServe);
      this.updateCombinedGraphics(this.graphicsRange);
    });
    // get all clients to find what is needed for tomorrow
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      // this is really weird. maybe some apsect of angular. but it works for now
      if (this.allUsers.length > 1) {
        this.getAllClients();
        // this.getAllClientsCard();
      }
      if (this.auth.isAdmin && this.allUsers.length > 0) {
        this.updateWeeklyPaymentDate();
      }
    });
  }
  percentage: string = '0';
  week: number = 5;
  month: number = 20;
  day: number = 1;
  theDay: string = new Date().toLocaleString('en-US', { weekday: 'long' });
  graphicsRange: number = this.week;
  graphicsRangeServe: number = this.week;
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  maxRange = 0;
  recentReserveDates: string[] = [];
  recentReserveAmounts: number[] = [];
  recentServeDates: string[] = [];
  recentServeAmounts: number[] = [];
  dailyExpense: string = '0';
  dailyBudgetExpense = '0';
  dailyPayment: string = '0';
  dailyBankFranc: string = '0';
  dailyBankDollar: string = '0';
  dailyServed: string = '0';
  dailyLoss: string = '0';
  dollarLoss: string = '0';
  dailyReserve: string = '0';
  dailyInvestment: string = '0';
  total: string = '';
  totalCard: string = '';
  track: number = 0;
  isAddOperation = false;
  budgetReason = '';

  userServeTodayTotals: Array<{
    firstName: string;
    total: number;
    totalInDollar: number;
    trackingId: string;
  }> = [];

  // NEW: grand totals for “today”
  overallTotalToday: number = 0;
  overallTotalTodayInDollars: number = 0;

  // ─── add new aggregate just after paymentTotal ──────────────
  overallMoneyInHands = 0;
  overallMoneyInHandsDollar = 0;
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

  clientsRequestLending: Client[] = [];
  clientsRequestSavings: Client[] = [];
  clientsRequestCard: Card[] = [];
  cards: Card[] = [];
  public graph: any = {
    data: [{}],
    layout: {
      title: 'Reserve Journalier en $',
      barmode: 'stack',
    },
  };
  public graphServe: any = {
    data: [{}],
    layout: {
      title: 'Argent A Servir Journalier en $',
      barmode: 'stack',
    },
  };

  public graphCombined: any = {
    data: [{}],
    layout: {
      title: 'Argent A Servir Journalier en $',
      barmode: 'stack',
    },
  };

  moneyInHands: string = '0';

  totalPerfomance: number = 0;

  linkPaths: string[] = [
    '/gestion-reserve',
    '/gestion-reserve',
    '/gestion-today',
    '/gestion-expenses',
    '/gestion-served',
    '/gestion-served',
    '/gestion-bank',
    '/gestion-loss',
    '/gestion-investment',
    '/gestion-fraudes',
  ];
  summary: string[] = [
    'Pourcentage Perte Du Mois',
    'Reserve Du Jour',
    'Argent En Main',
    'Depense Du Jour',
    'Dépenses Planifiées Du Jour',
    'Argent A Servir',
    'Argent En Banque Du Jour',
    'Perte Du Jour',
    'Investissement Du Jour',
    'Suivi des fraudes du mois',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/loss-ratio.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/expense.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/serve-money.png',
    '../../../assets/img/bank.png',
    '../../../assets/img/loss.png',
    '../../../assets/img/invest.svg',
    '../../../assets/img/expense.svg',
  ];

  isFetchingClients = false;
  currentClients: Array<Client[]> = [];
  currentClientsReserve: Client[] = [];
  allUsers: User[] = [];
  allClients?: Client[];
  allCurrentClients?: Client[] = [];
  allClientsCard?: Card[];
  userRequestTotals: Array<{
    firstName: string;

    total: number;
    totalInDollar: number;
    trackingId: string;
  }> = [];
  reserveTotals: Array<{
    firstName: string;
    payment?: number;
    paymentDollar?: number;
    total: number;
    totalInDollar: number;
    actual?: number;
    actualInDollar?: number;
    trackingId: string;
    // NEW
    missingReasons?: number; // # comments still absent
    totalReasons?: number; // # clients to leave a comment
    moneyInHands: number;
    moneyInHandsDollar: number;
    transportAmount?: number;
    dayExpense?: number;
    dayExpenseDollar?: number;
  }> = [];
  overallTotal: number = 0;
  overallTotalReserve: number = 0;
  overallTotalInDollars: number = 0;
  paymentTotal: number = 0;
  overallTotalReserveInDollars: number = 0;
  overallTransportAmount: number = 0;
  overallMissingReasons: number = 0;
  overallTotalReasons: number = 0;
  weeklyPaymentDate: string = this.time.getTodaysDateYearMonthDay();
  weeklyPaymentDateCorrectFormat: string = this.time.todaysDateMonthDayYear();
  weeklyPaymentRangeLabel: string = '';
  weeklyPaymentTotals: Array<{
    firstName: string;
    total: number;
    totalInDollar: number;
    weeklyTargetFc: number;
    weeklyProgressPercent: number;
    weeklyTargetReached: boolean;
    trackingId: string;
  }> = [];
  overallWeeklyPaymentTotal: number = 0;
  overallWeeklyPaymentTotalDollar: number = 0;
  getAllClients() {
    if (this.isFetchingClients) return;
    this.isFetchingClients = true;

    // Initialize userRequestTotals and overallTotal

    // Initialize userRequestTotals and overallTotal
    // 🔧  NEW – hard reset every time we start a fresh pass
    this.userRequestTotals = [];
    this.reserveTotals = [];
    this.overallTotal = 0;
    this.paymentTotal = 0;
    this.overallTotalReserve = 0;
    this.overallTransportAmount = 0;
    this.overallMissingReasons = 0;
    this.overallTotalReasons = 0;

    // NEW: reset today's structures
    this.userServeTodayTotals = [];
    this.overallTotalToday = 0;

    this.overallMoneyInHands = 0;
    this.overallMoneyInHandsDollar = 0;

    this.input = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'investments',
        this.requestDateCorrectFormat
      )
      .toString();
    this.inputDOllars = this.compute
      .convertCongoleseFrancToUsDollars(this.input)
      .toString();

    let completedRequests = 0;
    // Use effective date (skip Sunday if tomorrow is Sunday)
    const targetDate = this.requestDateRigthFormat === this.tomorrow 
      ? this.effectiveTomorrowDate 
      : this.requestDateRigthFormat; // freeze the value
    const { start: transportStart, end: transportEnd } =
      this.getDayRange(this.requestDateCorrectFormat);

    type TransportReceipt = { amount?: number };

    this.allUsers.forEach((user) => {
      // For each user, fetch both clients and cards
      forkJoin({
        clients: this.auth.getClientsOfAUser(user.uid!).pipe(take(1)),
        cards: this.auth.getClientsCardOfAUser(user.uid!).pipe(take(1)),
        receipts: this.afs
          .collection<TransportReceipt>(
            `users/${user.uid}/transportReceipts`,
            (ref) =>
              ref
                .where('ts', '>=', transportStart)
                .where('ts', '<=', transportEnd)
          )
          .valueChanges()
          .pipe(take(1)),
      }).subscribe(
        ({ clients, cards, receipts }) => {
          let userTotal = 0;
          let reserveTotal = 0;
          let userTotalToday = 0;

          // Process clients
          for (let client of clients) {
            const meetsTypeGate =
              client.requestStatus !== undefined &&
              ((client.requestType === 'lending' &&
                client.agentSubmittedVerification === 'true') ||
                client.requestType === 'savings' ||
                client.requestType === 'rejection');

            if (meetsTypeGate) {
              // existing target date (tomorrow / requestDateRigthFormat)
              if (client.requestDate === targetDate) {
                userTotal += Number(client.requestAmount);
              }
              // NEW: selected date (today or selected date)
              if (client.requestDate === this.requestDateCorrectFormat) {
                userTotalToday += Number(client.requestAmount);
              }
            }
          }

          const moneyHandsFC =
            Number(user.moneyInHands ?? 0) + Number(user.cardsMoney ?? 0);
          const moneyHandsDollar = Number(
            this.compute.convertCongoleseFrancToUsDollars(String(moneyHandsFC))
          );
          // first filter out as everyone and then add some more reasons
          this.currentClientsReserve = this.data.findClientsWithDebts(clients);
          this.currentClientsReserve = this.currentClientsReserve.filter(
            (data) => {
              return (
                Number(data.debtLeft) > 0 &&
                data.paymentDay === this.theDay &&
                data &&
                this.data.didClientStartThisWeek(data) // this condition can be confusing. it is the opposite
              );
            }
          );
          // ───── 1. Séparer ceux qui ont déjà payé aujourd’hui ───────────
          const unpaidToday: Client[] = this.currentClientsReserve.filter(
            (cl) => {
              const paidKeys = Object.keys(cl.payments || {}).filter(
                (k) => k.startsWith(this.today) // paiement horodaté aujourd’hui
              );
              return paidKeys.length === 0; // ⇦ donc pas encore payé
            }
          );

          // ───── 2. Compter les raisons manquantes ───────────────────────
          const totalReasons = unpaidToday.length;
          const missingReasons = unpaidToday.filter(
            (c) => !this.getTodaysComment(c)
          ).length;

          reserveTotal = this.compute.computeExpectedPerDate(
            this.currentClientsReserve
          );

          // Process cards
          for (let card of cards) {
            if (
              card.requestStatus !== undefined &&
              card.requestType === 'card'
            ) {
              // Use effective date for cards too (skip Sunday if tomorrow is Sunday)
              const cardTargetDate = this.requestDateRigthFormat === this.tomorrow 
                ? this.effectiveTomorrowDate 
                : this.requestDateRigthFormat;
              if (card.requestDate === cardTargetDate) {
                userTotal += Number(card.requestAmount);
              }
              // NEW: selected date (today or selected date)
              if (card.requestDate === this.requestDateCorrectFormat) {
                userTotalToday += Number(card.requestAmount);
              }
            }
          }

          // Store user data and total in the array
          this.userRequestTotals.push({
            firstName: user.firstName!,

            total: userTotal,
            totalInDollar: Number(
              this.compute.convertCongoleseFrancToUsDollars(
                userTotal.toString()
              )
            ),
            trackingId: user.uid!,
          });
          //  NEW: today row
          this.userServeTodayTotals.push({
            firstName: user.firstName!,
            total: userTotalToday,
            totalInDollar: Number(
              this.compute.convertCongoleseFrancToUsDollars(
                userTotalToday.toString()
              )
            ),
            trackingId: user.uid!,
          });
          const todayKeys = Object.keys(user.reserve || {}).filter((key) =>
            key.startsWith(this.requestDateCorrectFormat)
          );
          const paymentKeys = Object.keys(user.dailyReimbursement || {}).filter(
            (key) => key === this.requestDateCorrectFormat
          );

          // 2) Sum up raw FC payments
          const payment = paymentKeys.reduce(
            (sum, key) => sum + Number(user.dailyReimbursement?.[key] ?? 0),
            0
          );

          // 3) Sum up those same payments converted to USD
          const paymentDollar = paymentKeys.reduce(
            (sum, key) =>
              sum +
              Number(
                this.compute.convertCongoleseFrancToUsDollars(
                  String(user.dailyReimbursement?.[key] ?? 0)
                )
              ),
            0
          );

          const transportReceipts: TransportReceipt[] = receipts ?? [];
          const transportAmount = transportReceipts.reduce(
            (sum: number, receipt) => {
              const amount = Number(receipt.amount ?? 0);
              return sum + (isFinite(amount) ? amount : 0);
            },
            0
          );

          const dayExpense = Number(
            this.compute.findTotalForToday(
              (user.expenses ?? {}) as { [key: string]: string },
              this.requestDateCorrectFormat
            )
          );
          const dayExpenseDollar = Number(
            this.compute.convertCongoleseFrancToUsDollars(
              (Number.isFinite(dayExpense) ? dayExpense : 0).toString()
            )
          );

          this.reserveTotals.push({
            firstName: user.firstName!,

            total: reserveTotal,
            totalInDollar: Number(
              this.compute.convertCongoleseFrancToUsDollars(
                reserveTotal.toString()
              )
            ),
            payment,
            paymentDollar,
            actual: todayKeys.reduce(
              (sum, key) => sum + Number(user.reserve![key]),
              0
            ),
            // Default to 0 if undefined
            actualInDollar: todayKeys.reduce(
              (sum, key) =>
                sum +
                Number(
                  this.compute.convertCongoleseFrancToUsDollars(
                    user.reserve![key].toString()
                  )
                ),
              0
            ),
            trackingId: user.uid!,
            /* NEW */
            missingReasons,
            totalReasons,
            /* NEW ↓ */
            moneyInHands: moneyHandsFC,
            moneyInHandsDollar: moneyHandsDollar,
            transportAmount,
            dayExpense: Number.isFinite(dayExpense) ? dayExpense : 0,
            dayExpenseDollar: Number.isFinite(dayExpenseDollar)
              ? dayExpenseDollar
              : 0,
          });

          // Add to the overall total
          this.overallTotal += userTotal;
          this.overallTotalToday += userTotalToday;
          this.overallTotalReserve += reserveTotal;
          this.paymentTotal += payment;
          this.overallTransportAmount += transportAmount;
          // aggregate
          this.overallMoneyInHands += moneyHandsFC;
          this.overallMoneyInHandsDollar += moneyHandsDollar;

          completedRequests++;
          if (completedRequests === this.allUsers.length) {
            // All users have been processed
            this.userRequestTotals = this.userRequestTotals.filter((client) => {
              return client.total > 0;
            });
            // NEW: keep only rows with > 0 for today and sort
            this.userServeTodayTotals = this.userServeTodayTotals
              .filter((row) => row.total > 0)
              .sort((a, b) => b.total - a.total);

            // NEW: compute today's grand total in $
            this.overallTotalTodayInDollars = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallTotalToday.toString()
              )
            );

            // this.reserveTotals = this.reserveTotals.filter((client) => {
            //   return client.total > 0;
            // });
            this.reserveTotals = this.reserveTotals.filter((row) => {
              const t = row.total ?? 0;
              const a = row.actual ?? 0;
              const p = row.payment ?? 0; // optional: keep if a payment was recorded
              const tr = row.transportAmount ?? 0;
              return t > 0 || a > 0 || p > 0 || tr > 0;
            });
            const reasonsTotals = this.reserveTotals.reduce(
              (acc, row) => {
                const total = row.totalReasons ?? 0;
                const missing = row.missingReasons ?? 0;
                if (missing > 0) {
                  acc.total += total;
                  acc.missing += missing;
                }
                return acc;
              },
              { missing: 0, total: 0 }
            );
            this.overallMissingReasons = reasonsTotals.missing;
            this.overallTotalReasons = reasonsTotals.total;
            this.userRequestTotals.sort((a, b) => {
              return b.total - a.total;
            });
            // this.reserveTotals.sort((a, b) => {
            //   return b.total - a.total;
            // });
            // Sort by the stronger of the two metrics (or sum — pick what you prefer)
            this.reserveTotals.sort((a, b) => {
              const aKey = Math.max(a.total ?? 0, a.actual ?? 0);
              const bKey = Math.max(b.total ?? 0, b.actual ?? 0);
              return bKey - aKey;
            });

            this.overallTotalInDollars = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallTotal.toString()
              )
            );
            this.overallTotalReserveInDollars = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallTotalReserve.toString()
              )
            );
            // ─── after overallTotalReserveInDollars computation ─────────
            this.overallMoneyInHandsDollar = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallMoneyInHands.toString()
              )
            );
            this.percentage = (
              (Number(this.dailyReserve) / this.overallTotalReserve) *
              100
            ).toFixed(2);

            this.isFetchingClients = false;
            // Now you can use this.userRequestTotals and this.overallTotal in your template
            this.setGraphics();
          }
        },
        (error) => {
          console.error('Error fetching data for user:', user.firstName, error);
          completedRequests++;
          if (completedRequests === this.allUsers.length) {
            this.isFetchingClients = false;
          }
        }
      );
    });
  }

  yesterday = this.time.yesterdaysDateMonthDayYear();
  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  requestDateRigthFormat: string = this.getEffectiveTomorrowDate();
  frenchDateTomorrow = this.time.convertDateToDayMonthYear(this.requestDateRigthFormat);
  
  // Initialize date picker with effective tomorrow date (YYYY-MM-DD format)
  get requestDateTomorrow(): string {
    const effectiveDate = this.getEffectiveTomorrowDate();
    const [month, day, year] = effectiveDate.split('-').map(Number);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  
  set requestDateTomorrow(value: string) {
    // Store the value - the (change) event in HTML will call otherDate()
    this._requestDateTomorrow = value;
  }
  
  private _requestDateTomorrow: string = '';
  summaryContent: string[] = [];

  get isDefaultTomorrowDate(): boolean {
    // Check if the selected date matches the default effective tomorrow date
    return this.requestDateRigthFormat === this.effectiveTomorrowDate;
  }

  get displayDateForRequests(): string {
    // If using default tomorrow date, apply Sunday skip logic
    if (this.isDefaultTomorrowDate) {
      const [month, day, year] = this.tomorrow.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // If tomorrow is Sunday, skip to Monday
      if (date.getDay() === 0) {
        const mondayDate = new Date(date);
        mondayDate.setDate(date.getDate() + 1);
        const mondayMonth = mondayDate.getMonth() + 1;
        const mondayDay = mondayDate.getDate();
        const mondayYear = mondayDate.getFullYear();
        const mondayDateStr = `${mondayMonth}-${mondayDay}-${mondayYear}`;
        return this.time.convertDateToDayMonthYear(mondayDateStr);
      }
      
      return this.frenchDateTomorrow;
    }
    
    // For custom selected dates, use the selected date
    return this.frenchDateTomorrow;
  }

  get dayNameForRequests(): string {
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    
    // If using default tomorrow date, apply Sunday skip logic
    if (this.isDefaultTomorrowDate) {
      const [month, day, year] = this.tomorrow.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // If tomorrow is Sunday, skip to Monday
      if (date.getDay() === 0) {
        return 'Lundi';
      }
      
      return dayNames[date.getDay()];
    }
    
    // For custom selected dates, get the day name from the selected date
    const [month, day, year] = this.requestDateRigthFormat.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return dayNames[date.getDay()];
  }

  private getEffectiveTomorrowDate(): string {
    // Returns the date to use for fetching tomorrow's data (skips Sunday)
    const [month, day, year] = this.tomorrow.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // If tomorrow is Sunday, skip to Monday
    if (date.getDay() === 0) {
      const mondayDate = new Date(date);
      mondayDate.setDate(date.getDate() + 1);
      const mondayMonth = mondayDate.getMonth() + 1;
      const mondayDay = mondayDate.getDate();
      const mondayYear = mondayDate.getFullYear();
      return `${mondayMonth}-${mondayDay}-${mondayYear}`;
    }
    
    return this.tomorrow;
  }

  get effectiveTomorrowDate(): string {
    return this.getEffectiveTomorrowDate();
  }

  get tomorrowLabel(): string {
    // Only use "demain"/"lendemain" for default tomorrow date
    if (!this.isDefaultTomorrowDate) {
      return ''; // Empty string for custom dates
    }
    
    // Check if today is Saturday (so we're skipping Sunday to Monday)
    const [month, day, year] = this.today.split('-').map(Number);
    const todayDate = new Date(year, month - 1, day);
    
    // If today is Saturday, use "lendemain", otherwise "demain"
    if (todayDate.getDay() === 6) {
      return 'lendemain';
    }
    
    return 'demain';
  }
  givenMonthTotalLossAmount: string = '';
  givenMonthTotalLossAmountDollar: string = '';
  givenMonthTotalReserveAmount: string = '';
  givenMonthTotalFraudAmount: string = '0';
  fraudRatioOfReserve: number = 0;
  lossRatio: number = 0;
  input: string = '0';
  inputDOllars: string = '0';
  plannedToServeToday: string = '0';
  plannedToServeTodayDollars: string = '0';
  initalizeInputs() {
    const [selectedMonth, , selectedYear] = this.requestDateCorrectFormat
      .split('-')
      .map(Number);

    // this is to compute the loss ratio of the month which will serve for bonus for rebecca
    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.reserve!,
      selectedMonth,
      selectedYear
    );
    this.givenMonthTotalLossAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.exchangeLoss!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalLossAmountDollar = this.compute.findTotalGiventMonth(
      this.managementInfo?.dollarTransferLoss!,
      this.givenMonth,
      this.givenYear
    );
    let totalLoss = (
      Number(this.givenMonthTotalLossAmount) +
      Number(
        this.compute.convertUsDollarsToCongoleseFranc(
          this.givenMonthTotalLossAmountDollar
        )
      )
    ).toString();
    this.lossRatio =
      Math.ceil(
        (Number(totalLoss) / Number(this.givenMonthTotalReserveAmount)) * 10000
      ) / 100;
    this.dailyReserve = this.compute
      .findTotalForToday(
        this.managementInfo?.reserve!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyExpense = this.compute
      .findTotalForToday(
        this.managementInfo?.expenses!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBudgetExpense = this.compute
      .findTotalForToday(
        this.managementInfo?.budgetedExpenses!,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyServed = this.compute
      .findTotalForToday(
        this.managementInfo?.moneyGiven!,
        this.requestDateCorrectFormat
      )
      .toString();
    // Get the previous day of the selected date
    const previousDay = this.getPreviousDay(this.requestDateCorrectFormat);
    this.plannedToServeToday = this.compute
      .findTotalForToday(this.managementInfo?.moneyGiven!, previousDay)
      .toString();

    this.plannedToServeTodayDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.plannedToServeToday)
      .toString();
    this.dollarLoss = this.compute
      .findTotalForToday(
        this.managementInfo?.dollarTransferLoss!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBankFranc = this.compute
      .findTotalForToday(
        this.managementInfo?.bankDepositFrancs!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBankDollar = this.compute
      .findTotalForToday(
        this.managementInfo?.bankDepositDollars!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTotalForToday(
        this.managementInfo?.exchangeLoss!,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyInvestment = this.compute
      .findTotalForToday(
        this.managementInfo?.investment!,
        this.requestDateCorrectFormat
      )
      .toString();

    if (this.auth.managementInfo.reserve !== undefined)
      this.maxRange = this.auth.managementInfo.reserve.length;

    this.dailyBankFranc =
      this.dailyBankFranc === undefined ? '0' : this.dailyBankFranc;
    this.dailyInvestment =
      this.dailyInvestment === undefined ? '0' : this.dailyInvestment;
    this.dollarLoss = this.dollarLoss === undefined ? '0' : this.dollarLoss;
    this.dailyBankDollar =
      this.dailyBankDollar === undefined ? '0' : this.dailyBankDollar;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyExpense =
      this.dailyExpense === undefined ? '0' : this.dailyExpense;
    this.dailyBudgetExpense =
      this.dailyBudgetExpense === undefined ? '0' : this.dailyBudgetExpense;
    this.dailyLoss = this.dailyLoss === undefined ? '0' : this.dailyLoss;
    this.dailyServed = this.dailyServed === undefined ? '0' : this.dailyServed;
    this.moneyInHands =
      this.managementInfo?.moneyInHands === undefined
        ? '0'
        : this.managementInfo?.moneyInHands;
    let dloss = (
      Number(this.compute.convertUsDollarsToCongoleseFranc(this.dollarLoss)) +
      Number(this.dailyLoss)
    ).toString();

    this.givenMonthTotalFraudAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.fraudes!,
      selectedMonth,
      selectedYear
    );
    this.fraudRatioOfReserve =
      Number(this.givenMonthTotalReserveAmount) > 0
        ? Math.ceil(
            (Number(this.givenMonthTotalFraudAmount) /
              Number(this.givenMonthTotalReserveAmount)) *
              10000
          ) / 100
        : 0;

    this.summaryContent = [
      `${this.lossRatio}`,
      ` ${this.dailyReserve}`,
      `${this.moneyInHands}`,
      `${this.dailyExpense}`,
      `${this.dailyBudgetExpense}`,
      `${this.dailyServed}`,
      `${this.dailyBankFranc}`,
      `${dloss}`,
      `${this.dailyInvestment}`,
      `${this.givenMonthTotalFraudAmount}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.moneyInHands)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyBudgetExpense
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyServed)}`,
      `${this.dailyBankDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(dloss)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalFraudAmount
      )}`,
    ];
  }

  findDailyActivitiesAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    console.log('date', this.requestDateCorrectFormat);
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.initalizeInputs();
    this.getAllClients();
  }

  /**
   * Get the previous day for a given date in MM-DD-YYYY format
   */
  getPreviousDay(dateStr: string): string {
    // Parse the date string into a Date object
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Subtract one day from the date
    date.setDate(date.getDate() - 1);

    // Get the day, month, and year without leading zeros
    const prevDay = date.getDate();
    const prevMonth = date.getMonth() + 1;
    const prevYear = date.getFullYear();

    return `${prevMonth}-${prevDay}-${prevYear}`;
  }

  private getDayRange(dateStr: string): { start: number; end: number } {
    const [month, day, year] = dateStr.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    const end = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
    return { start, end };
  }

  updateWeeklyPaymentDate() {
    if (!this.auth.isAdmin) return;
    this.weeklyPaymentDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.weeklyPaymentDate
    );
    this.weeklyPaymentRangeLabel = this.computeWeeklyRangeLabel(
      this.weeklyPaymentDateCorrectFormat
    );
    this.computeWeeklyPaymentTotals();
  }

  private computeWeeklyPaymentTotals() {
    if (!this.auth.isAdmin) return;
    if (!this.allUsers || this.allUsers.length === 0) return;

    this.overallWeeklyPaymentTotal = 0;
    this.weeklyPaymentTotals = this.allUsers.map((user) => {
      const weeklyTargetFc = this.resolveWeeklyTargetFcForUser(user);
      const total = this.computeWeeklyPaymentTotalForUser(
        user,
        this.weeklyPaymentDateCorrectFormat
      );
      const totalInDollar = Number(
        this.compute.convertCongoleseFrancToUsDollars(total.toString())
      );
      const weeklyTargetReached = total >= weeklyTargetFc;
      const weeklyProgressPercent =
        weeklyTargetFc === 0 ? 0 : Math.min(100, (total / weeklyTargetFc) * 100);

      this.overallWeeklyPaymentTotal += total;

      return {
        firstName: user.firstName!,
        total,
        totalInDollar,
        weeklyTargetFc,
        weeklyProgressPercent,
        weeklyTargetReached,
        trackingId: user.uid!,
      };
    });

    this.weeklyPaymentTotals.sort((a, b) => b.total - a.total);
    this.overallWeeklyPaymentTotalDollar = Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.overallWeeklyPaymentTotal.toString()
      )
    );
  }

  private computeWeeklyPaymentTotalForUser(user: User, dateKey: string): number {
    const { start, end } = this.getWeekBounds(dateKey);
    const payments = user.dailyReimbursement || {};
    let total = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = this.formatDateKey(cursor);
      const amount = Number((payments as any)[key] ?? 0);
      if (!Number.isNaN(amount)) {
        total += amount;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private resolveWeeklyTargetFcForUser(user: User): number {
    const userOverride = Number(user.weeklyPaymentTargetFc);
    if (Number.isFinite(userOverride) && userOverride > 0) {
      return userOverride;
    }

    const globalTarget = Number(this.auth.weeklyPaymentTargetFc);
    if (Number.isFinite(globalTarget) && globalTarget > 0) {
      return globalTarget;
    }

    return 600000;
  }

  private computeWeeklyRangeLabel(dateKey: string): string {
    const { start, end } = this.getWeekBounds(dateKey);
    return `${this.formatWeekDate(start)} - ${this.formatWeekDate(end)}`;
  }

  private getWeekBounds(dateKey: string): { start: Date; end: Date } {
    const dateObj = this.time.toDate(dateKey);
    const dayIndex = dateObj.getDay();
    const daysSinceMonday = (dayIndex + 6) % 7;
    const start = new Date(dateObj);
    start.setDate(dateObj.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(0, 0, 0, 0);

    return { start, end };
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

  private formatDateKey(date: Date): string {
    return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  }
  setGraphics() {
    let num = Number(this.percentage);
    if (!isFinite(num)) num = 0;
    num = Math.max(0, Math.min(100, num));
    this.avgPerf = num; // <-- feeds the SVG ring

    const gaugeColor = this.compute.getGradientColor(num);
    this.graphMonthPerformance = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: { text: `Performance Du Jour` },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor },
            bar: { color: gaugeColor },
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 },
        responsive: true,
      },
    };
  }

  updateReserveGraphics(time: number) {
    let sorted = this.sortKeysAndValuesReserve(time);
    this.recentReserveDates = sorted[0];
    this.recentReserveAmounts = this.compute.convertToDollarsArray(sorted[1]);
    
    if (this.recentReserveAmounts.length < 2) {
      this.graph = this.createEmptyStockGraph('Reserve en $');
      return;
    }

    const firstValue = this.recentReserveAmounts[0] || 0;
    const lastValue = this.recentReserveAmounts[this.recentReserveAmounts.length - 1] || 0;
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive 
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 
      ? ((change / firstValue) * 100).toFixed(2)
      : '0.00';
    const changeSign = change >= 0 ? '+' : '';

    // Format dates for display - include year if spanning multiple years
    const firstDate = this.recentReserveDates[0] ? this.recentReserveDates[0].split('-').map(Number) : null;
    const lastDate = this.recentReserveDates[this.recentReserveDates.length - 1] ? this.recentReserveDates[this.recentReserveDates.length - 1].split('-').map(Number) : null;
    const spansMultipleYears = firstDate && lastDate && firstDate[2] !== lastDate[2];
    
    const formattedDates = this.recentReserveDates.map((dateStr) => {
      const [month, day, year] = dateStr.split('-').map(Number);
      if (spansMultipleYears) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}`;
    });

    this.graph = {
      data: [
        {
          x: formattedDates,
          y: this.recentReserveAmounts,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorstops: [
              { offset: 0, color: fillGradient[0] },
              { offset: 1, color: fillGradient[1] }
            ]
          },
          hovertemplate: '<b>%{x}</b><br>Réserve: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: 'Reserve en $',
          font: { 
            size: 20, 
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif'
          },
          x: 0.02,
          y: 0.95,
          xanchor: 'left',
          yanchor: 'top',
        },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.85,
            xanchor: 'left',
            yanchor: 'top',
            text: `<span style="font-size: 28px; font-weight: 600; color: #1a1a1a;">$${lastValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          }
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666'
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' }
          },
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickfont: {
            size: 11,
            color: '#666'
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' }
          },
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: false,
        autosize: true,
      },
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  updateServeGraphics(time: number) {
    let sorted = this.sortKeysAndValuesServe(time);
    this.recentServeDates = sorted[0];
    this.recentServeAmounts = this.compute.convertToDollarsArray(sorted[1]);
    
    if (this.recentServeAmounts.length < 2) {
      this.graphServe = this.createEmptyStockGraph('Argent A Servir en $');
      return;
    }

    const firstValue = this.recentServeAmounts[0] || 0;
    const lastValue = this.recentServeAmounts[this.recentServeAmounts.length - 1] || 0;
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive 
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 
      ? ((change / firstValue) * 100).toFixed(2)
      : '0.00';
    const changeSign = change >= 0 ? '+' : '';

    // Format dates for display - include year if spanning multiple years
    const firstDate = this.recentServeDates[0] ? this.recentServeDates[0].split('-').map(Number) : null;
    const lastDate = this.recentServeDates[this.recentServeDates.length - 1] ? this.recentServeDates[this.recentServeDates.length - 1].split('-').map(Number) : null;
    const spansMultipleYears = firstDate && lastDate && firstDate[2] !== lastDate[2];
    
    const formattedDates = this.recentServeDates.map((dateStr) => {
      const [month, day, year] = dateStr.split('-').map(Number);
      if (spansMultipleYears) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}`;
    });

    this.graphServe = {
      data: [
        {
          x: formattedDates,
          y: this.recentServeAmounts,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorstops: [
              { offset: 0, color: fillGradient[0] },
              { offset: 1, color: fillGradient[1] }
            ]
          },
          hovertemplate: '<b>%{x}</b><br>À servir: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: 'Argent A Servir en $',
          font: { 
            size: 20, 
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif'
          },
          x: 0.02,
          y: 0.95,
          xanchor: 'left',
          yanchor: 'top',
        },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.85,
            xanchor: 'left',
            yanchor: 'top',
            text: `<span style="font-size: 28px; font-weight: 600; color: #1a1a1a;">$${lastValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          }
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666'
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' }
          },
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickfont: {
            size: 11,
            color: '#666'
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' }
          },
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: false,
        autosize: true,
      },
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }
  sortKeysAndValuesReserve(time: number): [string[], string[]] {
    const dailyReimbursement = this.auth.managementInfo.reserve;

    // Aggregating values by day
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const day = key.split('-').slice(0, 3).join('-'); // Extracting the date part
      const numericValue = parseFloat(value as string); // Type assertion
      if (aggregatedData[day]) {
        aggregatedData[day] += numericValue;
      } else {
        aggregatedData[day] = numericValue;
      }
    }

    // Properly parse and sort dates (MM-DD-YYYY format)
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, dayA, yearA] = a.split('-').map(Number);
        const [monthB, dayB, yearB] = b.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-time);
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }

  sortKeysAndValuesServe(time: number) {
    const dailyReimbursement = this.auth.managementInfo.moneyGiven;

    // Aggregating values by day
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const day = key.split('-').slice(0, 3).join('-'); // Extracting the date part
      const numericValue = parseFloat(value as string); // Type assertion
      if (aggregatedData[day]) {
        aggregatedData[day] += numericValue;
      } else {
        aggregatedData[day] = numericValue;
      }
    }

    // Properly parse and sort dates (MM-DD-YYYY format)
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, dayA, yearA] = a.split('-').map(Number);
        const [monthB, dayB, yearB] = b.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-time);
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }

  otherDate() {
    // Use the stored value or get from getter if not set yet
    const dateValue = this._requestDateTomorrow || this.requestDateTomorrow;
    const selectedDate = this.time.convertDateToMonthDayYear(dateValue);
    
    // Check if user selected the default effective tomorrow date
    const effectiveTomorrow = this.getEffectiveTomorrowDate();
    
    if (selectedDate === effectiveTomorrow) {
      // User selected the default date, use effective tomorrow
      this.requestDateRigthFormat = effectiveTomorrow;
    } else {
      // User selected a custom date
      this.requestDateRigthFormat = selectedDate;
    }
    
    this.frenchDateTomorrow = this.time.convertDateToDayMonthYear(
      this.requestDateRigthFormat
    );
    this.getAllClients();
  }

  updateCombinedGraphics(time: number) {
    // Get Reserve data
    let [reserveDates, reserveVals] = this.sortKeysAndValuesReserve(time);
    let [serveDates, serveVals] = this.sortKeysAndValuesServe(time);

    // Convert them into sets for quick membership checks
    let reserveSet = new Set(reserveDates);
    let serveSet = new Set(serveDates);

    // Filter out any dates from Reserve if not in Serve, etc.:
    reserveDates = reserveDates.filter((d) => serveSet.has(d));
    // Do the same for the Serve side:
    serveDates = serveDates.filter((d) => reserveSet.has(d));
    let sortedReserve = this.sortKeysAndValuesReserve(time);
    let reserveAmounts = this.compute.convertToDollarsArray(sortedReserve[1]);

    let sortedServe = this.sortKeysAndValuesServe(time);
    let serveAmounts = this.compute.convertToDollarsArray(sortedServe[1]);

    if (reserveAmounts.length < 2 || serveAmounts.length < 2) {
      this.graphCombined = this.createEmptyStockGraph('Reserve & Argent A Servir (en $)');
      return;
    }

    // Format dates for display - include year if spanning multiple years
    const allDates = [...reserveDates, ...serveDates];
    const firstDate = allDates.length > 0 ? allDates[0].split('-').map(Number) : null;
    const lastDate = allDates.length > 0 ? allDates[allDates.length - 1].split('-').map(Number) : null;
    const spansMultipleYears = firstDate && lastDate && firstDate[2] !== lastDate[2];
    
    const formatDate = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-').map(Number);
      if (spansMultipleYears) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}`;
    };

    const formattedReserveDates = reserveDates.map(formatDate);
    const formattedServeDates = serveDates.map(formatDate);

    // Determine colors based on trends
    const reserveFirst = reserveAmounts[0] || 0;
    const reserveLast = reserveAmounts[reserveAmounts.length - 1] || 0;
    const reserveIsPositive = reserveLast >= reserveFirst;
    const reserveColor = reserveIsPositive ? '#26a69a' : '#ef5350';

    const serveFirst = serveAmounts[0] || 0;
    const serveLast = serveAmounts[serveAmounts.length - 1] || 0;
    const serveIsPositive = serveLast >= serveFirst;
    const serveColor = serveIsPositive ? '#3b82f6' : '#f59e0b';

    // Create two traces
    this.graphCombined = {
      data: [
        {
          x: formattedReserveDates,
          y: reserveAmounts,
          type: 'scatter',
          mode: 'lines',
          name: 'Reserve Par Jour',
          line: {
            color: reserveColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: reserveColor + '15',
          hovertemplate: '<b>%{x}</b><br>Réserve: <b>$%{y:,.2f}</b><extra></extra>',
        },
        {
          x: formattedServeDates,
          y: serveAmounts,
          type: 'scatter',
          mode: 'lines',
          name: 'Argent A Servir',
          line: {
            color: serveColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: serveColor + '15',
          hovertemplate: '<b>%{x}</b><br>À servir: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: 'Reserve & Argent A Servir (en $)',
          font: { 
            size: 20, 
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif'
          },
          x: 0.02,
          y: 0.95,
          xanchor: 'left',
          yanchor: 'top',
        },
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666'
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' }
          },
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickfont: {
            size: 11,
            color: '#666'
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' }
          },
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: true,
        legend: {
          x: 0.02,
          y: 0.85,
          xanchor: 'left',
          yanchor: 'top',
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          bordercolor: 'transparent',
        },
        autosize: true,
      },
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  private createEmptyStockGraph(title: string) {
    return {
      data: [],
      layout: {
        title: {
          text: title,
          font: { 
            size: 20, 
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif'
          },
        },
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickformat: '$,.0f',
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: false,
        autosize: true,
      },
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  // ─── modal state ───────────────────────────────────────────────
  showBudgetModal = false;
  budgetInput: number | null = null;

  openBudgetModal() {
    this.budgetInput = null;
    this.budgetReason = '';
    this.isAddOperation = false;
    this.showBudgetModal = true;
  }

  closeBudgetModal() {
    this.showBudgetModal = false;
  }
  async saveBudgetedExpense() {
    if (this.budgetInput === null || isNaN(this.budgetInput)) {
      alert('Montant invalide');
      return;
    }
    if (!this.budgetReason.trim()) {
      alert('Veuillez indiquer la raison');
      return;
    }

    const fc = Number(
      this.compute.convertUsDollarsToCongoleseFranc(this.budgetInput.toString())
    );

    await this.data.addBudgetPlannedExpense(fc, this.budgetReason);

    this.closeBudgetModal();
    this.initalizeInputs(); // refresh dashboard
    alert('Planned expense saved!');
  }
  /** Retourne le premier commentaire du jour ou null */
  private getTodaysComment(client: Client) {
    if (!client.comments?.length) return null;

    const [mm, dd, yyyy] = this.today.split('-'); // ex. 07-21-2025
    const normalised = `${Number(mm)}-${Number(dd)}-${yyyy}`;
    return client.comments.find((c) => c.time?.startsWith(normalised)) || null;
  }

  /* ───── click handler for card ───────── */
  onCardClick(i: number, ev: Event) {
    if (i === 4) {
      ev.preventDefault();
      ev.stopPropagation();
      this.openBudgetModal();
    }
  }

  get center(): number {
    return this.size / 2;
  }
  get radius(): number {
    return (this.size - this.strokeWidth) / 2;
  }
  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  colorForPerf(v: number): string {
    return this.compute.getGradientColor(Number(v || 0));
  }

  progressDasharray(): string {
    const c = this.circumference;
    const p = Math.max(0, Math.min(100, Number(this.avgPerf || 0))) / 100;
    return `${p * c} ${c}`;
  }
}
