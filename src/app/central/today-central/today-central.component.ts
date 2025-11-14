import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-today-central',
  templateUrl: './today-central.component.html',
  styleUrls: ['./today-central.component.css'],
})
export class TodayCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

  allUsers: User[] = [];
  ngOnInit(): void {
    // if (this.auth.isAdmin) {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.initalizeInputs();
    });
    // }
  }
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyPaymentDollars: string = '0';
  dailyReserve: string = '0';
  dailyReserveDollars: string = '0';
  dailyInvestement: string = '0';
  dailySaving: string = '0';
  dailySavingReturns = '0';
  dailyRequest: string = '0';
  dailyRequestDollars: string = '0';
  dailyExpense: string = '0';
  dailyFeesReturns: string = '0';
  dailyLoss: string = '0';

  sortedReserveToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedPaymentToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedRequestedTomorrow: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  totalPerfomance: number = 0;
  linkPaths: string[] = ['/daily-payments', '/daily-lendings', '/add-expense'];
  summary: string[] = [
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Reserve Du Jour',
    'Entrée Du Jour',
    'Epargne Du Jour',
    'Retrait Epargne Du Jour',
    'Depense Du Jour',
    `Retrait Frais De Membre Du Jour`,
    'Perte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/return.png',
    '../../../assets/img/loss.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  summaryContent: string[] = [];

  get tomorrowDayName(): string {
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    const [month, day, year] = this.tomorrow.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return dayNames[date.getDay()];
  }
  initalizeInputs() {
    this.dailyLending = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyLending',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyPayment = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyReimbursement',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyReserve = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'reserve',
        this.requestDateCorrectFormat
      )
      .toString();

    // Update monthly reserve graph
    this.updateMonthlyReserveGraph();
    // Update monthly payment graph
    this.updateMonthlyPaymentGraph();
    // Update mini graphs
    this.updateMiniGraphs();
    let tomorrow = this.findNextDay(this.requestDateCorrectFormat);

    this.dailyRequest = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyMoneyRequests',
        tomorrow
      )
      .toString();
    this.dailyInvestement = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'investments',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailySaving = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailySaving',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailySavingReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailySavingReturns',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyFeesReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyFeesReturns',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyExpense = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'expenses',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'losses',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyInvestement =
      this.dailyInvestement === undefined ? '0' : this.dailyInvestement;
    this.dailySaving = this.dailySaving === undefined ? '0' : this.dailySaving;
    this.dailyRequest =
      this.dailyRequest === undefined ? '0' : this.dailyRequest;
    this.dailyExpense =
      this.dailyExpense === undefined ? '0' : this.dailyExpense;
    this.dailyFeesReturns =
      this.dailyFeesReturns === undefined ? '0' : this.dailyFeesReturns;
    this.dailyLoss = this.dailyLoss === undefined ? '0' : this.dailyLoss;
    this.dailyReserveDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyReserve)
      .toString();
    this.dailyPaymentDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyPayment)
      .toString();
    this.dailyRequestDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyRequest)
      .toString();

    this.sortedReserveToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'reserve'
      );
    this.sortedPaymentToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'dailyReimbursement'
      );
    this.sortedRequestedTomorrow =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        tomorrow,
        this.allUsers,
        'dailyMoneyRequests'
      );
    this.summaryContent = [
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      `${this.dailyReserve}`,
      `${this.dailyInvestement}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
      `${this.dailyExpense}`,
      `${this.dailyFeesReturns}`,
      `${this.dailyLoss}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestement)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailySaving)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailySavingReturns
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFeesReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLoss)}`,
    ];
  }

  get todaySummaryCards() {
    return this.summary.map((title, index) => ({
      index,
      title,
      icon: this.imagePaths[index] ?? this.imagePaths[0],
      amountFc: this.toNum(this.summaryContent[index]),
      amountUsd: this.toNum(this.valuesConvertedToDollars[index]),
      link: this.linkPaths[index] ?? null,
    }));
  }

  get heroSnapshot() {
    return [
      {
        label: 'Paiements',
        value: this.toNum(this.dailyPayment),
        valueUsd: this.toNum(this.dailyPaymentDollars),
        icon: '💸',
      },
      {
        label: 'Réserves',
        value: this.toNum(this.dailyReserve),
        valueUsd: this.toNum(this.dailyReserveDollars),
        icon: '🏦',
      },
      {
        label: 'Demandes',
        value: this.toNum(this.dailyRequest),
        valueUsd: this.toNum(this.dailyRequestDollars),
        icon: '📅',
      },
    ];
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByLabel(_index: number, item: { label: string }): string {
    return item.label;
  }

  findDailyActivitiesCentralAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.initalizeInputs();
    // Graph will be updated in initalizeInputs via updateMonthlyReserveGraph
  }
  findNextDay(dateStr: string) {
    // Parse the date string into a Date object
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Add one day to the date
    date.setDate(date.getDate() + 1);

    // Get the day, month, and year without leading zeros
    const nextDay = date.getDate();
    const nextMonth = date.getMonth() + 1;
    const nextYear = date.getFullYear();

    return `${nextMonth}-${nextDay}-${nextYear}`;
  }
  // Helpers: robust to string|number and flexible field names
  toNum(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/\s/g, ''));
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
  val(obj: any, ...keys: string[]): any {
    if (!obj) return 0;
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return 0;
  }
  percentOf(value: any, basis: any): number {
    const v = this.toNum(value);
    const b = this.toNum(basis) || 1;
    return Math.max(0, (v / b) * 100);
  }

  // Baselines for today/tomorrow (bars = % of max $)
  get reserveTodayUSDMax(): number {
    const list = this.sortedReserveToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalReserveInDollars',
          'totalPaymentInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get paymentTodayUSDMax(): number {
    const list = this.sortedPaymentToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalPaymentInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get requestTomorrowUSDMax(): number {
    const list = this.sortedRequestedTomorrow ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalRequestedInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }

  // Monthly reserve graph
  monthlyReserveGraph: { data: any[]; layout: any; config?: any } = {
    data: [],
    layout: {},
    config: { responsive: true, displayModeBar: false },
  };

  // Monthly payment graph
  monthlyPaymentGraph: { data: any[]; layout: any; config?: any } = {
    data: [],
    layout: {},
    config: { responsive: true, displayModeBar: false },
  };

  // Selected location for filtering graph
  selectedLocation: string | null = null;
  selectedPaymentLocation: string | null = null;

  // Time range filter for graph
  selectedTimeRange: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX' = '1M';
  selectedPaymentTimeRange: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX' = '1M';

  // Mini graph cache
  miniReserveGraphs: Map<string, { data: any[]; layout: any; config?: any }> =
    new Map();
  miniPaymentGraphs: Map<string, { data: any[]; layout: any; config?: any }> =
    new Map();

  onLocationClick(locationName: string) {
    // Toggle selection: if clicking the same location, deselect it
    if (this.selectedLocation === locationName) {
      this.selectedLocation = null;
    } else {
      this.selectedLocation = locationName;
    }
    this.updateMonthlyReserveGraph();
  }

  onPaymentLocationClick(locationName: string) {
    // Toggle selection: if clicking the same location, deselect it
    if (this.selectedPaymentLocation === locationName) {
      this.selectedPaymentLocation = null;
    } else {
      this.selectedPaymentLocation = locationName;
    }
    this.updateMonthlyPaymentGraph();
  }

  onTimeRangeChange(range: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX') {
    this.selectedTimeRange = range;
    this.updateMonthlyReserveGraph();
  }

  onPaymentTimeRangeChange(range: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX') {
    this.selectedPaymentTimeRange = range;
    this.updateMonthlyPaymentGraph();
  }

  private updateMonthlyReserveGraph() {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.monthlyReserveGraph = this.createEmptyGraph();
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    // Calculate date range based on selected filter
    let startDate: Date;
    const endDate = new Date(currentYear, currentMonth - 1, today);

    switch (this.selectedTimeRange) {
      case '1D':
        // Compare with yesterday
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '1W':
        // Last 6 days (including today = 7 days total)
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '1M':
        // Current month
        startDate = new Date(currentYear, currentMonth - 1, 1);
        break;
      case '6M':
        // Last 6 months
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 5);
        break;
      case '1Y':
        // Last 12 months
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 11);
        break;
      case 'MAX':
        // Get earliest date from all users' reserve data
        let earliestDate: Date | null = null;
        this.allUsers.forEach((user) => {
          if (user.reserve) {
            Object.keys(user.reserve).forEach((dateStr) => {
              const normalizedDate = dateStr.split('-').slice(0, 3).join('-');
              const [month, day, year] = normalizedDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              if (!earliestDate || date < earliestDate) {
                earliestDate = date;
              }
            });
          }
        });
        startDate = earliestDate || new Date(currentYear, currentMonth - 1, 1);
        break;
      default:
        startDate = new Date(currentYear, currentMonth - 1, 1);
    }

    // Generate date range
    const labels: string[] = [];
    const values: number[] = [];
    const dateArray: Date[] = [];

    // Filter users by selected location if any
    const usersToProcess = this.selectedLocation
      ? this.allUsers.filter((user) => user.firstName === this.selectedLocation)
      : this.allUsers;

    // Generate dates based on range
    if (this.selectedTimeRange === '1D' || this.selectedTimeRange === '1W') {
      // Daily data - only include dates up to today
      const todayDate = new Date(currentYear, currentMonth - 1, today);
      const actualEndDate = endDate > todayDate ? todayDate : endDate;
      for (
        let d = new Date(startDate);
        d <= actualEndDate;
        d.setDate(d.getDate() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    } else if (this.selectedTimeRange === '1M') {
      // Daily data for current month
      for (let day = 1; day <= today; day++) {
        dateArray.push(new Date(currentYear, currentMonth - 1, day));
      }
    } else {
      // Monthly data for 6M, 1Y, MAX
      // Start from the first day of the start month
      const startMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      );
      // Only include up to current month
      const endMonth = new Date(currentYear, currentMonth - 1, 1);

      for (
        let d = new Date(startMonth);
        d <= endMonth;
        d.setMonth(d.getMonth() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    }

    // Calculate reserve for each date in range (in dollars)
    // Store data temporarily to filter out zero values
    const tempData: { label: string; value: number }[] = [];

    dateArray.forEach((date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();

      let reserve: string = '0';

      if (
        this.selectedTimeRange === '1D' ||
        this.selectedTimeRange === '1W' ||
        this.selectedTimeRange === '1M'
      ) {
        // Daily data
        const dateStr = `${month}-${day}-${year}`;

        if (this.selectedLocation) {
          // Get reserve for specific location
          const user = usersToProcess[0];
          if (user && user.reserve) {
            let dayReserve = 0;
            Object.entries(user.reserve).forEach(([dateKey, amount]) => {
              const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
              if (normalizedDate === dateStr) {
                const numericAmount = amount.split(':')[0];
                dayReserve += parseInt(numericAmount, 10);
              }
            });
            reserve = dayReserve.toString();
          }
        } else {
          // Get total reserve for all users
          reserve = this.compute.findTodayTotalResultsGivenField(
            this.allUsers,
            'reserve',
            dateStr
          );
        }
      } else {
        // Monthly data - sum all days in the month (up to today if current month)
        const isCurrentMonth = month === currentMonth && year === currentYear;
        const daysInMonth = isCurrentMonth
          ? today
          : new Date(year, month, 0).getDate();
        let monthReserve = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${month}-${d}-${year}`;
          let dayReserve: string = '0';

          if (this.selectedLocation) {
            const user = usersToProcess[0];
            if (user && user.reserve) {
              let dayReserveNum = 0;
              Object.entries(user.reserve).forEach(([dateKey, amount]) => {
                const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
                if (normalizedDate === dateStr) {
                  const numericAmount = amount.split(':')[0];
                  dayReserveNum += parseInt(numericAmount, 10);
                }
              });
              dayReserve = dayReserveNum.toString();
            }
          } else {
            dayReserve = this.compute.findTodayTotalResultsGivenField(
              this.allUsers,
              'reserve',
              dateStr
            );
          }
          monthReserve += this.toNum(dayReserve);
        }
        reserve = monthReserve.toString();
      }

      const reserveNum = this.toNum(reserve);
      // Convert to dollars
      const reserveInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(reserveNum.toString())
      );

      // Only add non-zero values
      if (reserveInDollars > 0) {
        // Format label based on range
        let label: string;
        if (
          this.selectedTimeRange === '1D' ||
          this.selectedTimeRange === '1W' ||
          this.selectedTimeRange === '1M'
        ) {
          label = day.toString();
        } else {
          // Monthly labels
          const monthNames = [
            'Jan',
            'Fév',
            'Mar',
            'Avr',
            'Mai',
            'Jun',
            'Jul',
            'Aoû',
            'Sep',
            'Oct',
            'Nov',
            'Déc',
          ];
          label = `${monthNames[month - 1]} ${year}`;
        }
        tempData.push({ label, value: reserveInDollars });
      }
    });

    // Extract filtered labels and values
    tempData.forEach((item) => {
      labels.push(item.label);
      values.push(item.value);
    });

    // Get first and last reserve values (in dollars)
    const firstReserve = values[0] || 0;
    const lastReserve = values[values.length - 1] || 0;

    // Determine color: red if first > last (decreased), green if first < last (increased)
    // Stock market style: green for gains, red for losses
    const isPositive = lastReserve >= firstReserve;
    const lineColor = isPositive ? '#26a69a' : '#ef5350'; // Teal green or red
    const fillGradient = isPositive
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)'] // Green gradient
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)']; // Red gradient

    // Build title with location name if selected
    const locationPrefix = this.selectedLocation
      ? `${this.selectedLocation} - `
      : '';
    const rangeLabels: { [key: string]: string } = {
      '1D': '1 Jour',
      '1W': '1 Semaine',
      '1M': '1 Mois',
      '6M': '6 Mois',
      '1Y': '1 An',
      MAX: 'Maximum',
    };
    const titleText = `${locationPrefix}Réserve - ${
      rangeLabels[this.selectedTimeRange]
    }`;

    // Calculate percentage change
    const change = lastReserve - firstReserve;
    const changePercent =
      firstReserve > 0 ? ((change / firstReserve) * 100).toFixed(2) : '0.00';
    const changeSign = change >= 0 ? '+' : '';

    this.monthlyReserveGraph = {
      data: [
        {
          x: labels,
          y: values,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline', // Smooth curves like stock charts
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
              { offset: 1, color: fillGradient[1] },
            ],
          },
          hovertemplate:
            '<b>Jour %{x}</b><br>' +
            'Réserve: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: titleText,
          font: {
            size: 20,
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif',
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
            text: `<span style="font-size: 28px; font-weight: 600; color: #1a1a1a;">$${lastReserve.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          },
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666',
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' },
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
            color: '#666',
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' },
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

  private updateMonthlyPaymentGraph() {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.monthlyPaymentGraph = this.createEmptyPaymentGraph();
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    // Calculate date range based on selected filter
    let startDate: Date;
    const endDate = new Date(currentYear, currentMonth - 1, today);

    switch (this.selectedPaymentTimeRange) {
      case '1D':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '1W':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '1M':
        startDate = new Date(currentYear, currentMonth - 1, 1);
        break;
      case '6M':
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 5);
        break;
      case '1Y':
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 11);
        break;
      case 'MAX':
        let earliestDate: Date | null = null;
        this.allUsers.forEach((user) => {
          if (user.dailyReimbursement) {
            Object.keys(user.dailyReimbursement).forEach((dateStr) => {
              const normalizedDate = dateStr.split('-').slice(0, 3).join('-');
              const [month, day, year] = normalizedDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              if (!earliestDate || date < earliestDate) {
                earliestDate = date;
              }
            });
          }
        });
        startDate = earliestDate || new Date(currentYear, currentMonth - 1, 1);
        break;
      default:
        startDate = new Date(currentYear, currentMonth - 1, 1);
    }

    // Generate date range
    const labels: string[] = [];
    const values: number[] = [];
    const dateArray: Date[] = [];

    // Filter users by selected location if any
    const usersToProcess = this.selectedPaymentLocation
      ? this.allUsers.filter(
          (user) => user.firstName === this.selectedPaymentLocation
        )
      : this.allUsers;

    // Generate dates based on range
    if (
      this.selectedPaymentTimeRange === '1D' ||
      this.selectedPaymentTimeRange === '1W'
    ) {
      const todayDate = new Date(currentYear, currentMonth - 1, today);
      const actualEndDate = endDate > todayDate ? todayDate : endDate;
      for (
        let d = new Date(startDate);
        d <= actualEndDate;
        d.setDate(d.getDate() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    } else if (this.selectedPaymentTimeRange === '1M') {
      for (let day = 1; day <= today; day++) {
        dateArray.push(new Date(currentYear, currentMonth - 1, day));
      }
    } else {
      const startMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      );
      const endMonth = new Date(currentYear, currentMonth - 1, 1);
      for (
        let d = new Date(startMonth);
        d <= endMonth;
        d.setMonth(d.getMonth() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    }

    // Calculate payment for each date in range (in dollars)
    // Store data temporarily to filter out zero values
    const tempData: { label: string; value: number }[] = [];

    dateArray.forEach((date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();

      let payment: string = '0';

      if (
        this.selectedPaymentTimeRange === '1D' ||
        this.selectedPaymentTimeRange === '1W' ||
        this.selectedPaymentTimeRange === '1M'
      ) {
        const dateStr = `${month}-${day}-${year}`;

        if (this.selectedPaymentLocation) {
          const user = usersToProcess[0];
          if (user && user.dailyReimbursement) {
            let dayPayment = 0;
            Object.entries(user.dailyReimbursement).forEach(
              ([dateKey, amount]) => {
                const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
                if (normalizedDate === dateStr) {
                  const numericAmount = amount.split(':')[0];
                  dayPayment += parseInt(numericAmount, 10);
                }
              }
            );
            payment = dayPayment.toString();
          }
        } else {
          payment = this.compute.findTodayTotalResultsGivenField(
            this.allUsers,
            'dailyReimbursement',
            dateStr
          );
        }
      } else {
        const isCurrentMonth = month === currentMonth && year === currentYear;
        const daysInMonth = isCurrentMonth
          ? today
          : new Date(year, month, 0).getDate();
        let monthPayment = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${month}-${d}-${year}`;
          let dayPayment: string = '0';

          if (this.selectedPaymentLocation) {
            const user = usersToProcess[0];
            if (user && user.dailyReimbursement) {
              let dayPaymentNum = 0;
              Object.entries(user.dailyReimbursement).forEach(
                ([dateKey, amount]) => {
                  const normalizedDate = dateKey
                    .split('-')
                    .slice(0, 3)
                    .join('-');
                  if (normalizedDate === dateStr) {
                    const numericAmount = amount.split(':')[0];
                    dayPaymentNum += parseInt(numericAmount, 10);
                  }
                }
              );
              dayPayment = dayPaymentNum.toString();
            }
          } else {
            dayPayment = this.compute.findTodayTotalResultsGivenField(
              this.allUsers,
              'dailyReimbursement',
              dateStr
            );
          }
          monthPayment += this.toNum(dayPayment);
        }
        payment = monthPayment.toString();
      }

      const paymentNum = this.toNum(payment);
      const paymentInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(paymentNum.toString())
      );

      // Only add non-zero values
      if (paymentInDollars > 0) {
        // Format label based on range
        let label: string;
        if (
          this.selectedPaymentTimeRange === '1D' ||
          this.selectedPaymentTimeRange === '1W' ||
          this.selectedPaymentTimeRange === '1M'
        ) {
          label = day.toString();
        } else {
          const monthNames = [
            'Jan',
            'Fév',
            'Mar',
            'Avr',
            'Mai',
            'Jun',
            'Jul',
            'Aoû',
            'Sep',
            'Oct',
            'Nov',
            'Déc',
          ];
          label = `${monthNames[month - 1]} ${year}`;
        }
        tempData.push({ label, value: paymentInDollars });
      }
    });

    // Extract filtered labels and values
    tempData.forEach((item) => {
      labels.push(item.label);
      values.push(item.value);
    });

    const firstPayment = values[0] || 0;
    const lastPayment = values[values.length - 1] || 0;

    const isPositive = lastPayment >= firstPayment;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const locationPrefix = this.selectedPaymentLocation
      ? `${this.selectedPaymentLocation} - `
      : '';
    const rangeLabels: { [key: string]: string } = {
      '1D': '1 Jour',
      '1W': '1 Semaine',
      '1M': '1 Mois',
      '6M': '6 Mois',
      '1Y': '1 An',
      MAX: 'Maximum',
    };
    const titleText = `${locationPrefix}Paiement - ${
      rangeLabels[this.selectedPaymentTimeRange]
    }`;

    const change = lastPayment - firstPayment;
    const changePercent =
      firstPayment > 0 ? ((change / firstPayment) * 100).toFixed(2) : '0.00';
    const changeSign = change >= 0 ? '+' : '';

    this.monthlyPaymentGraph = {
      data: [
        {
          x: labels,
          y: values,
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
              { offset: 1, color: fillGradient[1] },
            ],
          },
          hovertemplate:
            '<b>Jour %{x}</b><br>' +
            'Paiement: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: titleText,
          font: {
            size: 20,
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif',
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
            text: `<span style="font-size: 28px; font-weight: 600; color: #1a1a1a;">$${lastPayment.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          },
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666',
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' },
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
            color: '#666',
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' },
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

  private createEmptyGraph(title?: string) {
    return {
      data: [],
      layout: {
        title: {
          text: title || 'Réserve Totale - Ce Mois',
          font: { size: 18, color: '#0f172a' },
        },
        xaxis: { title: 'Jour du mois' },
        yaxis: { title: 'Réserve ($)' },
        height: 400,
        margin: { t: 50, r: 20, l: 60, b: 50 },
        plot_bgcolor: 'rgba(255,255,255,0)',
        paper_bgcolor: 'rgba(255,255,255,0)',
      },
      config: { responsive: true, displayModeBar: false },
    };
  }

  private createEmptyPaymentGraph(title?: string) {
    return {
      data: [],
      layout: {
        title: {
          text: title || 'Paiement Total - Ce Mois',
          font: { size: 18, color: '#0f172a' },
        },
        xaxis: { title: 'Jour du mois' },
        yaxis: { title: 'Paiement ($)' },
        height: 400,
        margin: { t: 50, r: 20, l: 60, b: 50 },
        plot_bgcolor: 'rgba(255,255,255,0)',
        paper_bgcolor: 'rgba(255,255,255,0)',
      },
      config: { responsive: true, displayModeBar: false },
    };
  }

  private updateMiniGraphs() {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.miniReserveGraphs.clear();
      this.miniPaymentGraphs.clear();
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    // Clear existing graphs
    this.miniReserveGraphs.clear();
    this.miniPaymentGraphs.clear();

    // Generate mini graphs for each user
    this.allUsers.forEach((user) => {
      if (!user.firstName) return;

      // Reserve mini graph
      if (user.reserve) {
        const reserveGraph = this.createMiniGraph(
          user,
          'reserve',
          currentMonth,
          currentYear,
          today
        );
        if (reserveGraph) {
          this.miniReserveGraphs.set(user.firstName, reserveGraph);
        }
      }

      // Payment mini graph
      if (user.dailyReimbursement) {
        const paymentGraph = this.createMiniGraph(
          user,
          'dailyReimbursement',
          currentMonth,
          currentYear,
          today
        );
        if (paymentGraph) {
          this.miniPaymentGraphs.set(user.firstName, paymentGraph);
        }
      }
    });
  }

  private createMiniGraph(
    user: User,
    field: 'reserve' | 'dailyReimbursement',
    currentMonth: number,
    currentYear: number,
    today: number
  ): { data: any[]; layout: any; config?: any } | null {
    const data = user[field];
    if (!data) return null;

    const values: number[] = [];

    // Get last 4 days of data for better curve visualization
    // Only include non-zero values
    for (let i = 3; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, today - i);
      // Allow cross-month boundaries for better data
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const dateStr = `${month}-${day}-${year}`;

      let dayValue = 0;
      try {
        Object.entries(data).forEach(([dateKey, amount]) => {
          const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
          if (normalizedDate === dateStr) {
            const numericAmount = String(amount).split(':')[0];
            dayValue += parseInt(numericAmount, 10) || 0;
          }
        });
      } catch (e) {
        // Skip if error
        dayValue = 0;
      }

      const valueInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(dayValue.toString())
      );

      // Only add non-zero values
      if (valueInDollars > 0) {
        values.push(valueInDollars);
      }
    }

    if (values.length < 2) {
      return this.createEmptyMiniGraph();
    }

    // Determine color based on trend (compare first to last)
    const firstValue = values[0] || 0;
    const lastValue = values[values.length - 1] || 0;
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';

    // Normalize values to fit nicely in the small space (0-100 scale)
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1; // Avoid division by zero
    const normalizedValues = values.map((v) => ((v - minVal) / range) * 100);

    // Create sequential x-axis indices for non-zero values
    const xIndices = values.map((_, index) => index);

    return {
      data: [
        {
          x: xIndices,
          y: normalizedValues,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: lineColor + '15',
          hovertemplate: '<b>$%{customdata:,.2f}</b><extra></extra>',
          customdata: values, // Store original values for hover
        },
      ],
      layout: {
        height: 40,
        width: 100,
        margin: { t: 2, r: 2, l: 2, b: 2 },
        xaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
          range:
            xIndices.length > 0
              ? [xIndices[0] - 0.1, xIndices[xIndices.length - 1] + 0.1]
              : [-0.1, 2.1],
        },
        yaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
          range: [0, 100],
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false,
      },
      config: {
        responsive: false,
        displayModeBar: false,
        staticPlot: true,
      },
    };
  }

  getMiniReserveGraph(locationName: string): {
    data: any[];
    layout: any;
    config?: any;
  } {
    return (
      this.miniReserveGraphs.get(locationName) || this.createEmptyMiniGraph()
    );
  }

  getMiniPaymentGraph(locationName: string): {
    data: any[];
    layout: any;
    config?: any;
  } {
    return (
      this.miniPaymentGraphs.get(locationName) || this.createEmptyMiniGraph()
    );
  }

  private createEmptyMiniGraph() {
    return {
      data: [],
      layout: {
        height: 40,
        width: 100,
        margin: { t: 0, r: 0, l: 0, b: 0 },
        xaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
        },
        yaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
      },
      config: { responsive: false, displayModeBar: false, staticPlot: true },
    };
  }
}
