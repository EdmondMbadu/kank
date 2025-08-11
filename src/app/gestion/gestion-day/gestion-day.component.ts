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

@Component({
  selector: 'app-gestion-day',
  templateUrl: './gestion-day.component.html',
  styleUrls: ['./gestion-day.component.css'],
})
export class GestionDayComponent implements OnInit {
  managementInfo?: Management = {};
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService
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
  public graph = {
    data: [{}],
    layout: {
      title: 'Reserve Journalier en $',
      barmode: 'stack',
    },
  };
  public graphServe = {
    data: [{}],
    layout: {
      title: 'Argent A Servir Journalier en $',
      barmode: 'stack',
    },
  };

  public graphCombined = {
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
  }> = [];
  overallTotal: number = 0;
  overallTotalReserve: number = 0;
  overallTotalInDollars: number = 0;
  paymentTotal: number = 0;
  overallTotalReserveInDollars: number = 0;
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

    this.overallMoneyInHands = 0;
    this.overallMoneyInHandsDollar = 0;

    let completedRequests = 0;
    const targetDate = this.requestDateRigthFormat; // freeze the value
    this.allUsers.forEach((user) => {
      // For each user, fetch both clients and cards
      forkJoin({
        clients: this.auth.getClientsOfAUser(user.uid!).pipe(take(1)),
        cards: this.auth.getClientsCardOfAUser(user.uid!).pipe(take(1)),
      }).subscribe(
        ({ clients, cards }) => {
          console.log('[DEBUG] user doc:', user);
          let userTotal = 0;
          let reserveTotal = 0;

          // Process clients
          for (let client of clients) {
            if (
              client.requestStatus !== undefined &&
              ((client.requestType === 'lending' &&
                client.agentSubmittedVerification === 'true') ||
                client.requestType === 'savings' ||
                client.requestType === 'rejection') &&
              client.requestDate === targetDate
            ) {
              userTotal += Number(client.requestAmount);
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
              card.requestType === 'card' &&
              card.requestDate === this.requestDateRigthFormat
            ) {
              userTotal += Number(card.requestAmount);
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
          const todayKeys = Object.keys(user.reserve || {}).filter((key) =>
            key.startsWith(this.today)
          );
          const paymentKeys = Object.keys(user.dailyReimbursement || {}).filter(
            (key) => key === this.today
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
          });

          // Add to the overall total
          this.overallTotal += userTotal;
          this.overallTotalReserve += reserveTotal;
          this.paymentTotal += payment;
          // aggregate
          this.overallMoneyInHands += moneyHandsFC;
          this.overallMoneyInHandsDollar += moneyHandsDollar;

          completedRequests++;
          if (completedRequests === this.allUsers.length) {
            // All users have been processed
            this.userRequestTotals = this.userRequestTotals.filter((client) => {
              return client.total > 0;
            });
            // this.reserveTotals = this.reserveTotals.filter((client) => {
            //   return client.total > 0;
            // });
            this.reserveTotals = this.reserveTotals.filter((row) => {
              const t = row.total ?? 0;
              const a = row.actual ?? 0;
              const p = row.payment ?? 0; // optional: keep if a payment was recorded
              return t > 0 || a > 0 || p > 0;
            });
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

  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateTomorrow: string = this.time.getTomorrowsDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  requestDateRigthFormat: string = this.tomorrow;
  frenchDateTomorrow = this.time.convertDateToDayMonthYear(this.tomorrow);
  summaryContent: string[] = [];
  givenMonthTotalLossAmount: string = '';
  givenMonthTotalLossAmountDollar: string = '';
  givenMonthTotalReserveAmount: string = '';
  lossRatio: number = 0;
  initalizeInputs() {
    // this is to compute the loss ratio of the month which will serve for bonus for rebecca
    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.reserve!,
      this.givenMonth,
      this.givenYear
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
  }
  setGraphics() {
    let num = Number(this.percentage);
    let gaugeColor = this.compute.getGradientColor(Number(num));
    this.graphMonthPerformance = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Performance Du Jour`,
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
  updateReserveGraphics(time: number) {
    let sorted = this.sortKeysAndValuesReserve(time);
    this.recentReserveDates = sorted[0];
    this.recentReserveAmounts = this.compute.convertToDollarsArray(sorted[1]);
    const color1 = this.compute.findColor(sorted[1]);
    this.graph = {
      data: [
        {
          x: this.recentReserveDates,
          y: this.recentReserveAmounts,
          type: 'scatter',
          mode: 'lines',
          marker: { color: 'rgb(0,76,153)' },
          line: {
            color: color1,
            shape: 'spline',
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Reserve en $',
        barmode: 'stack',
      },
    };
  }

  updateServeGraphics(time: number) {
    let sorted = this.sortKeysAndValuesServe(time);
    this.recentServeDates = sorted[0];
    this.recentServeAmounts = this.compute.convertToDollarsArray(sorted[1]);
    const color1 = this.compute.findColor(sorted[1]);
    this.graphServe = {
      data: [
        {
          x: this.recentServeDates,
          y: this.recentServeAmounts,
          type: 'scatter',
          mode: 'lines',
          marker: { color: 'rgb(0,76,153)' },
          line: {
            color: color1,
            shape: 'spline',
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Argent A Servir en $',
        barmode: 'stack',
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

    // Sorting and slicing
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => +new Date(a) - +new Date(b))
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

    // Sorting and slicing
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => +new Date(a) - +new Date(b))
      .slice(-time);
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }

  otherDate() {
    this.requestDateRigthFormat = this.time.convertDateToMonthDayYear(
      this.requestDateTomorrow
    );
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
    // let reserveDates = sortedReserve[0];
    let reserveAmounts = this.compute.convertToDollarsArray(sortedReserve[1]);
    console.log('reserve data', sortedReserve[0]);

    let sortedServe = this.sortKeysAndValuesServe(time);
    // let serveDates = sortedServe[0];
    console.log('serve data', sortedServe[0]);
    let serveAmounts = this.compute.convertToDollarsArray(sortedServe[1]);

    // Create two traces
    this.graphCombined = {
      data: [
        {
          x: reserveDates,
          y: reserveAmounts,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Reserve Par Jour',
        },
        {
          x: serveDates,
          y: serveAmounts,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Argent A Servir',
        },
      ],
      layout: {
        title: 'Reserve & Argent A Servir (en $)',
        barmode: 'stack',
        // xaxis: { title: 'Date' },
        // yaxis: { title: 'Montant ($)' }
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
}
