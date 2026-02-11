import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-month',
  templateUrl: './gestion-month.component.html',
  styleUrls: ['./gestion-month.component.css'],
})
export class GestionMonthComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
    public compute: ComputationService
  ) {}
  ngOnInit() {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.initalizeInputs();
      // Calculate forecast if a model is already selected
      if (this.selectedForecastModel !== 'none') {
        this.onForecastModelChange();
      } else {
        this.updateReserveGraphics(this.graphicsRange);
      }
    });
  }

  day: number = 1;
  graphicsRange: number = this.compute.quarter1;
  graphicsRangeServe: number = this.compute.quarter1;
  maxRange = 0;
  public graph: { data: any[]; layout: any } = {
    data: [{}],
    layout: {
      title: 'Reserve Journalier en $',
      barmode: 'stack',
    },
  };
  selectedForecastModel: 'none' | 'model1' | 'model2' | 'model3' | 'model4' | 'combined' = 'none';
  forecastModels = [
    { id: 'none', name: 'Aucun', description: 'Afficher uniquement les données historiques' },
    { id: 'model1', name: 'Modèle 1', description: 'Taux de croissance roulant (baseline mensuel)' },
    { id: 'model2', name: 'Modèle 2', description: 'Régression de tendance + saisonnalité' },
    { id: 'model3', name: 'Modèle 3', description: 'Taux d\'exécution quotidien (hors dimanches)' },
    { id: 'model4', name: 'Modèle 4', description: 'Taux d\'exécution hiérarchique par localisation' },
    { id: 'combined', name: 'Combiné', description: 'Moyenne pondérée des 4 modèles' },
  ];
  currentForecast: { date: string; value: number; valueInDollars: number } | null = null;
  showModelInfo: boolean = false;
  managementInfo?: Management = {};
  recentReserveDates: string[] = [];
  recentReserveAmounts: number[] = [];
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  // Forecast target month/year (defaults to current month)
  forecastTargetMonth: number = this.currentMonth;
  forecastTargetYear: number = this.currentDate.getFullYear();
  // Number of months back to use for forecast calculations (default 3)
  monthsBackForForecast: number = 3;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  yearsList: number[] = this.time.yearsList;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  monthYear = `${this.month} ${this.year}`;
  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/gestion-reserve',
    '/gestion-today',
    '/gestion-expenses',
    '/gestion-expenses',
    '/gestion-served',
    '/gestion-bank',
    '/gestion-loss',
    '/gestion-investment',
    '/gestion-fraudes',
    '/gestion-month',
  ];
  summary: string[] = [
    'Pourcentage Perte Du Mois',
    'Reserve Du Mois',
    'Argent En Main',
    'Depense Du Mois',
    'Dépenses Planifiées Du Mois',
    'Argent Servi Mois',
    'Argent En Banque Du Mois',
    'Perte Du Du Mois',
    'Investissement Du Mois',
    'Suivi des fraudes du mois',
    ' Benefice Reel Du Mois',
  ];
  valuesConvertedToDollars: string[] = [];

  givenMonthTotalReserveAmount: string = '';
  moneyInHands: string = '';
  givenMonthTotalExpenseAmount: string = '';
  givenMonthTotalServedAmount: string = '';
  givenMonthTotalBankAmountFrancs: string = '';
  givenMonthTotalBankAmountDollar: string = '';
  givenMonthTotalLossAmountDollar: string = '';
  givenMonthTotalLossAmount: string = '';
  givenMonthTotalInvestmentAmount: string = '';
  givenMonthTotalBudgetedExpenseAmount: string = '';
  givenMonthTotalFraudAmount: string = '0';
  fraudRatioOfReserve: number = 0;

  givenMonthRealGain: string = '';

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
    '../../../assets/img/benefit.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  lossRatio: number = 0;
  initalizeInputs() {
    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.reserve!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalBudgetedExpenseAmount =
      this.compute.findTotalGiventMonth(
        this.managementInfo?.budgetedExpenses!,
        this.givenMonth,
        this.givenYear
      );
    this.moneyInHands = this.managementInfo?.moneyInHands!;

    this.givenMonthTotalExpenseAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.expenses!,
      this.givenMonth,
      this.givenYear
    );

    // the reserve amount per month is an approximation
    this.givenMonthTotalExpenseAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.expenses!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalServedAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.moneyGiven!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalBankAmountFrancs = this.compute.findTotalGiventMonth(
      this.managementInfo?.bankDepositFrancs!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalBankAmountDollar = this.compute.findTotalGiventMonth(
      this.managementInfo?.bankDepositDollars!,
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
    this.givenMonthTotalInvestmentAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.investment!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalFraudAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.fraudes!,
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
    this.fraudRatioOfReserve =
      Number(this.givenMonthTotalReserveAmount) > 0
        ? Math.ceil(
            (Number(this.givenMonthTotalFraudAmount) /
              Number(this.givenMonthTotalReserveAmount)) *
              10000
          ) / 100
        : 0;

    // find the real gain
    this.givenMonthRealGain = (
      Number(this.givenMonthTotalReserveAmount) -
      Number(this.givenMonthTotalServedAmount) -
      Number(this.givenMonthTotalExpenseAmount) -
      Number(this.givenMonthTotalBudgetedExpenseAmount) -
      Number(this.givenMonthTotalLossAmount)
    ).toString();
    this.summaryContent = [
      `${this.lossRatio}`,
      `${this.givenMonthTotalReserveAmount}`,
      `${this.moneyInHands}`,
      `${this.givenMonthTotalExpenseAmount}`,
      `${this.givenMonthTotalBudgetedExpenseAmount}`,
      `${this.givenMonthTotalServedAmount}`,
      `${this.givenMonthTotalBankAmountFrancs}`,
      `${totalLoss}`,
      `${this.givenMonthTotalInvestmentAmount}`,
      `${this.givenMonthTotalFraudAmount}`,
      `${this.givenMonthRealGain}`,
    ];
    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalReserveAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.moneyInHands)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalExpenseAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalBudgetedExpenseAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalServedAmount
      )}`,
      `${this.givenMonthTotalBankAmountDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(totalLoss)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalInvestmentAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalFraudAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthRealGain
      )}`,
    ];
  }

  updateReserveGraphics(time: number) {
    this.graphicsRange = time; // Update the current range
    let sorted = this.sortKeysAndValuesReserve(time);

    this.recentReserveDates = sorted[0];
    this.recentReserveAmounts = this.compute.convertToDollarsArray(sorted[1]);
    const color1 = this.compute.findColor(sorted[1]);
    
    // Prepare graph data
    const graphData: any[] = [
      {
        x: this.recentReserveDates,
        y: this.recentReserveAmounts,
        type: 'bar',
        mode: 'lines',
        marker: { color: color1 },
        line: {
          color: 'rgb(34, 139, 34)',
        },
        name: 'Données historiques',
      },
    ];

    // Add forecast if a model is selected
    if (this.selectedForecastModel !== 'none' && this.managementInfo?.reserve) {
      const forecast = this.calculateForecast(this.selectedForecastModel);
      if (forecast && forecast.value !== null && forecast.value > 0) {
        // Always use the target month/year for the forecast date
        const forecastDate = `${this.forecastTargetMonth.toString().padStart(2, '0')}-${this.forecastTargetYear}`;
        const forecastValue = this.compute.convertCongoleseFrancToUsDollars(forecast.value.toString());
        
        // Check if forecast date is already in historical data
        const forecastIndex = this.recentReserveDates.indexOf(forecastDate);
        const isForecastNew = forecastIndex === -1;
        
        // Find the point to connect from (last historical point before forecast)
        let connectFromDate = '';
        let connectFromValue = 0;
        
        // Find the month that comes right before the forecast target month
        const targetDate = new Date(this.forecastTargetYear, this.forecastTargetMonth - 1, 1);
        
        // Find the last historical point that is before the target month
        for (let i = this.recentReserveDates.length - 1; i >= 0; i--) {
          const histDate = this.recentReserveDates[i];
          const [histMonth, histYear] = histDate.split('-').map(Number);
          const histDateObj = new Date(histYear, histMonth - 1, 1);
          
          if (histDateObj < targetDate) {
            connectFromDate = histDate;
            connectFromValue = this.recentReserveAmounts[i];
            break;
          }
        }
        
        // Fallback: if no previous month found, use the last historical point
        if (!connectFromDate && this.recentReserveDates.length > 0) {
          connectFromDate = this.recentReserveDates[this.recentReserveDates.length - 1];
          connectFromValue = this.recentReserveAmounts[this.recentReserveAmounts.length - 1];
        }
        
        // Add connecting line from historical point to forecast
        if (connectFromDate && connectFromValue > 0) {
          graphData.push({
            x: [connectFromDate, forecastDate],
            y: [connectFromValue, forecastValue],
            type: 'scatter',
            mode: 'lines',
            line: {
              color: 'rgba(255, 140, 0, 0.6)',
              width: 3,
              dash: 'dot',
            },
            name: 'Transition vers prévision',
            showlegend: false,
            hoverinfo: 'skip',
          });
        }

        // Always add forecast point (even if month exists in historical data)
        // This shows the forecasted value vs actual partial value
        graphData.push({
          x: [forecastDate],
          y: [forecastValue],
          type: 'scatter',
          mode: 'markers+lines',
          marker: {
            color: 'rgb(255, 140, 0)',
            size: 14,
            symbol: 'diamond',
            line: { color: 'rgb(255, 165, 0)', width: 2 },
          },
          line: {
            color: 'rgb(255, 140, 0)',
            width: 2,
            dash: 'dash',
          },
          name: `Prévision (${this.forecastModels.find(m => m.id === this.selectedForecastModel)?.name})`,
          showlegend: true,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Mois: %{x}<br>' +
                        'Valeur prévue: $%{y:,.0f}<extra></extra>',
        });
      }
    }

    this.graph = {
      data: graphData,
      layout: {
        title: 'Reserve en $',
        barmode: 'stack',
        hovermode: 'closest',
        xaxis: {
          title: 'Période (Mois-Année)',
          showgrid: true,
          gridcolor: 'rgba(148, 163, 184, 0.2)',
        },
        yaxis: {
          title: 'Montant ($)',
          showgrid: true,
          gridcolor: 'rgba(148, 163, 184, 0.2)',
        },
        legend: {
          orientation: 'h',
          yanchor: 'bottom',
          y: 1.02,
          xanchor: 'right',
          x: 1,
        },
        transition: {
          duration: 500,
          easing: 'cubic-in-out',
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
      },
    };
  }

  sortKeysAndValuesReserve(time: number): [string[], string[]] {
    const dailyReimbursement = this.auth.managementInfo.reserve;

    // Aggregating values by month (MM-YYYY)
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = key.split('-');
      const monthYear = `${month}-${year}`; // Create MM-YYYY format

      const numericValue = parseFloat(value as string); // Convert value to number
      if (aggregatedData[monthYear]) {
        aggregatedData[monthYear] += numericValue; // Aggregate values
      } else {
        aggregatedData[monthYear] = numericValue; // Initialize if not present
      }
    }

    // Sorting the keys in chronological order and limiting the results to the last `time` months
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, yearA] = a.split('-');
        const [monthB, yearB] = b.split('-');
        return (
          new Date(`${yearA}-${monthA}-01`).getTime() -
          new Date(`${yearB}-${monthB}-01`).getTime()
        );
      })
      .slice(-time);

    // Mapping the sorted keys to their corresponding values
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }

  // Get monthly totals as array of {monthYear: string, value: number, monthIndex: number}
  getMonthlyTotals(): Array<{ monthYear: string; value: number; monthIndex: number }> {
    const dailyReimbursement = this.managementInfo?.reserve || {};
    const aggregatedData: { [key: string]: number } = {};

    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = key.split('-');
      const monthYear = `${month}-${year}`;
      const numericValue = parseFloat(value as string);
      if (aggregatedData[monthYear]) {
        aggregatedData[monthYear] += numericValue;
      } else {
        aggregatedData[monthYear] = numericValue;
      }
    }

    const sorted = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, yearA] = a.split('-');
        const [monthB, yearB] = b.split('-');
        return (
          new Date(`${yearA}-${monthA}-01`).getTime() -
          new Date(`${yearB}-${monthB}-01`).getTime()
        );
      })
      .map((key, index) => {
        const [month, year] = key.split('-');
        return {
          monthYear: key,
          value: aggregatedData[key],
          monthIndex: index,
        };
      });

    return sorted;
  }

  // Model 1: Rolling Growth Rate - Forecast for TARGET month
  forecastModel1(): { date: string; value: number } | null {
    const monthlyData = this.getMonthlyTotals();
    if (monthlyData.length < 2) return null;

    const targetMonth = this.forecastTargetMonth;
    const targetYear = this.forecastTargetYear;
    
    // Normalize month format for comparison (handle both "1-2024" and "01-2024")
    const normalizeMonthYear = (monthYear: string): string => {
      const [month, year] = monthYear.split('-');
      return `${parseInt(month)}-${year}`;
    };
    
    const targetMonthKeyNormalized = `${targetMonth}-${targetYear}`;

    // Filter out the target month from monthly data (only use complete months before target)
    const completeMonths = monthlyData.filter((m) => {
      const normalized = normalizeMonthYear(m.monthYear);
      const [mMonth, mYear] = normalized.split('-').map(Number);
      // Only include months that are before the target month
      if (mYear < targetYear) return true;
      if (mYear === targetYear && mMonth < targetMonth) return true;
      return false;
    });

    if (completeMonths.length < 2) return null;

    // Use last N complete months to calculate average growth (N = monthsBackForForecast)
    const k = Math.min(this.monthsBackForForecast, completeMonths.length - 1);
    const growthFactors: number[] = [];

    // Calculate growth rates from the last k complete months
    // We need at least k+1 months to calculate k growth rates
    const startIndex = Math.max(0, completeMonths.length - k - 1);
    
    for (let i = startIndex + 1; i < completeMonths.length; i++) {
      const prevMonth = completeMonths[i - 1];
      const currMonth = completeMonths[i];
      
      if (prevMonth.value > 0) {
        const growth = currMonth.value / prevMonth.value;
        growthFactors.push(growth);
      }
    }

    if (growthFactors.length === 0) return null;

    // Calculate average growth rate
    const avgGrowth = growthFactors.reduce((a, b) => a + b, 0) / growthFactors.length;
    
    // Get the last complete month (most recent month that's not current)
    const lastCompleteMonth = completeMonths[completeMonths.length - 1];
    
    // Forecast for CURRENT month by applying average growth to last complete month
    const forecastValue = lastCompleteMonth.value * avgGrowth;

    // Return in the format expected by the graph (MM-YYYY)
    const targetMonthKey = `${targetMonth.toString().padStart(2, '0')}-${targetYear}`;

    return {
      date: targetMonthKey,
      value: forecastValue,
    };
  }

  // Model 2: Trend + Seasonality Regression - Forecast for TARGET month
  forecastModel2(): { date: string; value: number } | null {
    const monthlyData = this.getMonthlyTotals();
    if (monthlyData.length < 3) return null;

    const targetMonth = this.forecastTargetMonth;
    const targetYear = this.forecastTargetYear;
    
    // Normalize month format for comparison (handle both "1-2024" and "01-2024")
    const normalizeMonthYear = (monthYear: string): string => {
      const [month, year] = monthYear.split('-');
      return `${parseInt(month)}-${year}`;
    };
    
    const targetMonthKeyNormalized = `${targetMonth}-${targetYear}`;

    // Filter out the target month from monthly data (only use complete months before target)
    const completeMonths = monthlyData.filter((m) => {
      const normalized = normalizeMonthYear(m.monthYear);
      const [mMonth, mYear] = normalized.split('-').map(Number);
      // Only include months that are before the target month
      if (mYear < targetYear) return true;
      if (mYear === targetYear && mMonth < targetMonth) return true;
      return false;
    });

    if (completeMonths.length < 3) return null;

    const n = completeMonths.length;
    const hasSeasonality = n >= 12;

    // Simple linear regression: Y = β0 + β1*t
    let sumT = 0;
    let sumY = 0;
    let sumTY = 0;
    let sumT2 = 0;

    completeMonths.forEach((data, index) => {
      const t = index + 1;
      const y = data.value;
      sumT += t;
      sumY += y;
      sumTY += t * y;
      sumT2 += t * t;
    });

    const beta1 = (n * sumTY - sumT * sumY) / (n * sumT2 - sumT * sumT);
    const beta0 = (sumY - beta1 * sumT) / n;

    // Seasonality adjustment (if we have enough data)
    let seasonalityAdjustment = 0;
    if (hasSeasonality) {
      const monthOfYear = targetMonth; // Use target month for seasonality
      const sameMonthValues = completeMonths
        .filter((d) => {
          const [month] = d.monthYear.split('-');
          return parseInt(month) === monthOfYear;
        })
        .map((d) => d.value);
      if (sameMonthValues.length > 1) {
        const avgSameMonth = sameMonthValues.reduce((a, b) => a + b, 0) / sameMonthValues.length;
        const overallAvg = sumY / n;
        seasonalityAdjustment = avgSameMonth - overallAvg;
      }
    }

    // Forecast for target month (next position after last complete month)
    const nextT = n + 1;
    const forecastValue = beta0 + beta1 * nextT + seasonalityAdjustment;

    // Return target month's date
    const targetMonthKey = `${targetMonth.toString().padStart(2, '0')}-${targetYear}`;

    return {
      date: targetMonthKey,
      value: Math.max(0, forecastValue), // Ensure non-negative
    };
  }

  // Model 3: Daily Run-Rate Extrapolation (excluding Sundays)
  forecastModel3(): { date: string; value: number } | null {
    const reserve = this.managementInfo?.reserve || {};
    const targetMonth = this.forecastTargetMonth;
    const targetYear = this.forecastTargetYear;

    // Get all days in target month
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    
    // Determine "today" - if target month is in the past, use last day of that month
    // If target month is current month, use actual today
    // If target month is future, return null (can't forecast future with current data)
    const targetDateStart = new Date(targetYear, targetMonth - 1, 1);
    const currentDateObj = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate());
    
    let today: number;
    if (targetDateStart > currentDateObj) {
      // Future month - can't forecast with current data
      return null;
    } else if (targetDateStart.getMonth() === currentDateObj.getMonth() && targetDateStart.getFullYear() === currentDateObj.getFullYear()) {
      // Current month - use actual today
      today = this.currentDate.getDate();
    } else {
      // Past month - use last day of that month
      today = daysInMonth;
    }

    // Calculate workdays (excluding Sundays) and sum data
    let workdaysSoFar = 0;
    let workdaysTotal = 0;
    let sumSoFar = 0;

    // Helper to check if a date key matches a specific day
    const matchesDate = (key: string, month: number, day: number, year: number): boolean => {
      const parts = key.split('-');
      if (parts.length < 3) return false;
      const keyMonth = parseInt(parts[0]);
      const keyDay = parseInt(parts[1]);
      const keyYear = parseInt(parts[2]);
      return keyMonth === month && keyDay === day && keyYear === year;
    };

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetYear, targetMonth - 1, day);
      const isSunday = date.getDay() === 0;

      if (!isSunday) {
        workdaysTotal++;
        if (day <= today) {
          // Find all reserve entries that match this date (handle keys with/without timestamps)
          let dayValue = 0;
          for (const [key, value] of Object.entries(reserve)) {
            if (matchesDate(key, targetMonth, day, targetYear)) {
              dayValue += parseFloat(value || '0');
            }
          }
          sumSoFar += dayValue;
          // Count ALL workdays up to and including today (regardless of whether they have data)
          workdaysSoFar++;
        }
      }
    }

    // Need at least some workdays with data, or be in the current month
    if (workdaysSoFar === 0 && today > 1) {
      // If we're past day 1 but have no data, still try to forecast
      // Use average from previous months as fallback
      const monthlyData = this.getMonthlyTotals();
      if (monthlyData.length > 0) {
        const avgMonthly = monthlyData.reduce((sum, m) => sum + m.value, 0) / monthlyData.length;
        const avgDaily = avgMonthly / 26; // Approximate workdays per month
        const remainingWorkdays = workdaysTotal - workdaysSoFar;
        const forecastValue = sumSoFar + avgDaily * remainingWorkdays;
        
        return {
          date: `${targetMonth.toString().padStart(2, '0')}-${targetYear}`,
          value: forecastValue,
        };
      }
      return null;
    }

    if (workdaysSoFar === 0) return null;

    const dailyAvg = sumSoFar / workdaysSoFar;
    const remainingWorkdays = workdaysTotal - workdaysSoFar;
    const forecastValue = sumSoFar + dailyAvg * remainingWorkdays;

    return {
      date: `${targetMonth.toString().padStart(2, '0')}-${targetYear}`,
      value: forecastValue,
    };
  }

  // Model 4: Hierarchical Per-Location Run-Rate
  // Note: Since we don't have location data in Management model, we'll use a simplified version
  // that treats the reserve as a single "location" with growth trend
  forecastModel4(): { date: string; value: number } | null {
    const reserve = this.managementInfo?.reserve || {};
    const targetMonth = this.forecastTargetMonth;
    const targetYear = this.forecastTargetYear;

    // Get target month data
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    
    // Determine "today" - if target month is in the past, use last day of that month
    // If target month is current month, use actual today
    // If target month is future, return null (can't forecast future with current data)
    const targetDateStart = new Date(targetYear, targetMonth - 1, 1);
    const currentDateObj = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate());
    
    let today: number;
    if (targetDateStart > currentDateObj) {
      // Future month - can't forecast with current data
      return null;
    } else if (targetDateStart.getMonth() === currentDateObj.getMonth() && targetDateStart.getFullYear() === currentDateObj.getFullYear()) {
      // Current month - use actual today
      today = this.currentDate.getDate();
    } else {
      // Past month - use last day of that month
      today = daysInMonth;
    }

    // Helper to check if a date key matches a specific day
    const matchesDate = (key: string, month: number, day: number, year: number): boolean => {
      const parts = key.split('-');
      if (parts.length < 3) return false;
      const keyMonth = parseInt(parts[0]);
      const keyDay = parseInt(parts[1]);
      const keyYear = parseInt(parts[2]);
      return keyMonth === month && keyDay === day && keyYear === year;
    };

    let workdaysSoFar = 0;
    let workdaysTotal = 0;
    let sumSoFar = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetYear, targetMonth - 1, day);
      const isSunday = date.getDay() === 0;

      if (!isSunday) {
        workdaysTotal++;
        if (day <= today) {
          // Find all reserve entries that match this date (handle keys with/without timestamps)
          let dayValue = 0;
          for (const [key, value] of Object.entries(reserve)) {
            if (matchesDate(key, targetMonth, day, targetYear)) {
              dayValue += parseFloat(value || '0');
            }
          }
          sumSoFar += dayValue;
          // Count ALL workdays up to and including today (regardless of whether they have data)
          workdaysSoFar++;
        }
      }
    }

    if (workdaysSoFar === 0 && today > 1) {
      // Fallback: use average from previous months
      const monthlyData = this.getMonthlyTotals();
      const normalizeMonthYear = (monthYear: string): string => {
        const [month, year] = monthYear.split('-');
        return `${parseInt(month)}-${year}`;
      };
      const targetMonthKeyNormalized = `${targetMonth}-${targetYear}`;
      
      // Only use months before target
      const completeMonths = monthlyData.filter((m) => {
        const normalized = normalizeMonthYear(m.monthYear);
        const [mMonth, mYear] = normalized.split('-').map(Number);
        if (mYear < targetYear) return true;
        if (mYear === targetYear && mMonth < targetMonth) return true;
        return false;
      });
      
      if (completeMonths.length > 0) {
        const avgMonthly = completeMonths.reduce((sum, m) => sum + m.value, 0) / completeMonths.length;
        const avgDaily = avgMonthly / 26; // Approximate workdays per month
        
        // Calculate growth rate from previous months
        let growthRate = 1.0;
        if (completeMonths.length >= 2) {
          const k = Math.min(this.monthsBackForForecast, completeMonths.length - 1);
          const recentGrowth: number[] = [];
          for (let i = completeMonths.length - k; i < completeMonths.length; i++) {
            if (i > 0 && completeMonths[i - 1].value > 0) {
              recentGrowth.push(completeMonths[i].value / completeMonths[i - 1].value);
            }
          }
          if (recentGrowth.length > 0) {
            growthRate = recentGrowth.reduce((a, b) => a + b, 0) / recentGrowth.length;
          }
        }
        
        const remainingWorkdays = workdaysTotal - workdaysSoFar;
        const forecastValue = sumSoFar + (avgDaily * growthRate) * remainingWorkdays;
        
        return {
          date: `${targetMonth.toString().padStart(2, '0')}-${targetYear}`,
          value: forecastValue,
        };
      }
      return null;
    }

    if (workdaysSoFar === 0) return null;

    // Calculate growth rate from previous months (before target month)
    const monthlyData = this.getMonthlyTotals();
    const normalizeMonthYear = (monthYear: string): string => {
      const [month, year] = monthYear.split('-');
      return `${parseInt(month)}-${year}`;
    };
    const completeMonths = monthlyData.filter((m) => {
      const normalized = normalizeMonthYear(m.monthYear);
      const [mMonth, mYear] = normalized.split('-').map(Number);
      if (mYear < targetYear) return true;
      if (mYear === targetYear && mMonth < targetMonth) return true;
      return false;
    });
    
    let growthRate = 1.0;
    if (completeMonths.length >= 2) {
      const k = Math.min(this.monthsBackForForecast, completeMonths.length - 1);
      const recentGrowth: number[] = [];
      for (let i = completeMonths.length - k; i < completeMonths.length; i++) {
        if (i > 0 && completeMonths[i - 1].value > 0) {
          recentGrowth.push(completeMonths[i].value / completeMonths[i - 1].value);
        }
      }
      if (recentGrowth.length > 0) {
        growthRate = recentGrowth.reduce((a, b) => a + b, 0) / recentGrowth.length;
      }
    }

    const dailyAvg = (sumSoFar / workdaysSoFar) * growthRate;
    const remainingWorkdays = workdaysTotal - workdaysSoFar;
    const forecastValue = sumSoFar + dailyAvg * remainingWorkdays;

    return {
      date: `${targetMonth.toString().padStart(2, '0')}-${targetYear}`,
      value: forecastValue,
    };
  }

  // Calculate forecast based on selected model
  calculateForecast(model: string): { date: string; value: number } | null {
    switch (model) {
      case 'model1':
        return this.forecastModel1();
      case 'model2':
        return this.forecastModel2();
      case 'model3':
        return this.forecastModel3();
      case 'model4':
        return this.forecastModel4();
      case 'combined':
        const f1 = this.forecastModel1();
        const f2 = this.forecastModel2();
        const f3 = this.forecastModel3();
        const f4 = this.forecastModel4();

        const forecasts = [f1, f2, f3, f4].filter((f) => f !== null) as Array<{
          date: string;
          value: number;
        }>;

        if (forecasts.length === 0) return null;

        // Weighted average: 0.2*F1 + 0.2*F2 + 0.3*F3 + 0.3*F4
        const weights = [0.2, 0.2, 0.3, 0.3];
        let weightedSum = 0;
        let totalWeight = 0;

        [f1, f2, f3, f4].forEach((f, i) => {
          if (f !== null) {
            weightedSum += f.value * weights[i];
            totalWeight += weights[i];
          }
        });

        if (totalWeight === 0) return null;

        const combinedValue = weightedSum / totalWeight;
        // Always use the target month/year for the date, not the first available forecast date
        const targetMonthKey = `${this.forecastTargetMonth.toString().padStart(2, '0')}-${this.forecastTargetYear}`;

        return { date: targetMonthKey, value: combinedValue };
      default:
        return null;
    }
  }

  // Method to handle forecast model change
  onForecastModelChange() {
    // Calculate and store current forecast
    if (this.selectedForecastModel !== 'none') {
      const forecast = this.calculateForecast(this.selectedForecastModel);
      if (forecast && forecast.value !== null && forecast.value > 0) {
        // Ensure the forecast date matches the target month/year
        const expectedDate = `${this.forecastTargetMonth.toString().padStart(2, '0')}-${this.forecastTargetYear}`;
        const dollarsStr = this.compute.convertCongoleseFrancToUsDollars(forecast.value.toString());
        const dollarsValue = typeof dollarsStr === 'string' ? parseFloat(dollarsStr) || 0 : dollarsStr;
        this.currentForecast = {
          date: expectedDate, // Always use the target month/year, not the forecast date
          value: forecast.value,
          valueInDollars: dollarsValue,
        };
      } else {
        this.currentForecast = null;
      }
    } else {
      this.currentForecast = null;
    }
    this.updateReserveGraphics(this.graphicsRange);
  }

  // Method to handle forecast target month/year change
  onForecastTargetChange() {
    // Recalculate forecast if a model is selected
    if (this.selectedForecastModel !== 'none') {
      this.onForecastModelChange();
    } else {
      this.updateReserveGraphics(this.graphicsRange);
    }
  }

  // Method to handle months back change
  onMonthsBackChange() {
    // Ensure value is a number and between 1 and 12
    this.monthsBackForForecast = Number(this.monthsBackForForecast);
    if (isNaN(this.monthsBackForForecast) || this.monthsBackForForecast < 1) {
      this.monthsBackForForecast = 1;
    }
    if (this.monthsBackForForecast > 12) {
      this.monthsBackForForecast = 12;
    }
    
    // Recalculate forecast if a model is selected
    if (this.selectedForecastModel !== 'none') {
      this.onForecastModelChange();
    }
  }

  // Helper method to format month-year for display
  formatMonthYear(monthYear: string): string {
    const [month, year] = monthYear.split('-');
    const monthName = this.time.monthFrenchNames[parseInt(month) - 1];
    return `${monthName} ${year}`;
  }
}
