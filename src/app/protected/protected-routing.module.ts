import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../services/auth.guard';
import { InvestementsSummaryComponent } from '../components/investements-summary/investements-summary.component';
import { HomeCentralComponent } from '../central/home-central/home-central.component';
import { BenefitComponent } from '../components/benefit/benefit.component';
import { TrackingComponent } from '../components/tracking/tracking.component';
import { TrackingCentralComponent } from '../central/tracking-central/tracking-central.component';
import { TrackingMonthComponent } from '../components/tracking-month/tracking-month.component';
import { TrackingMonthCentralComponent } from '../central/tracking-month-central/tracking-month-central.component';
import { TrackingCardMonthComponent } from '../card/tracking-card-month/tracking-card-month.component';
import { TrackingCardMonthCentralComponent } from '../central/tracking-card-month-central/tracking-card-month-central.component';
import { TodayComponent } from '../components/today/today.component';
import { TodayCentralComponent } from '../central/today-central/today-central.component';
import { TodayCardComponent } from '../card/today-card/today-card.component';
import { TodayCardCentralComponent } from '../central/today-card-central/today-card-central.component';
import { RetraceComponent } from '../components/retrace/retrace.component';
import { ClientInfoComponent } from '../components/client-info/client-info.component';
import { InfoRegisterComponent } from '../components/info-register/info-register.component';
import { SummaryCardComponent } from '../card/summary-card/summary-card.component';
import { SummaryCardCentralComponent } from '../central/summary-card-central/summary-card-central.component';
import { ClientInfoCurrentComponent } from '../components/client-info-current/client-info-current.component';
import { ClientInfoSavingsComponent } from '../components/client-info-savings/client-info-savings.component';
import { ClientInfoCardComponent } from '../card/client-info-card/client-info-card.component';
import { NewClientComponent } from '../components/new-client/new-client.component';
import { RegisterClientComponent } from '../components/register-client/register-client.component';
import { NewCycleRegisterComponent } from '../components/new-cycle-register/new-cycle-register.component';
import { NewCardComponent } from '../components/new-card/new-card.component';
import { ClientPortalComponent } from '../components/client-portal/client-portal.component';
import { ClientCycleComponent } from '../components/client-cycle/client-cycle.component';
import { FinishedDebtComponent } from '../components/finished-debt/finished-debt.component';
import { RegiserPortalComponent } from '../components/register-portal/register-portal.component';
import { ClientPortalCardComponent } from '../card/client-portal-card/client-portal-card.component';
import { AmountInvestedComponent } from '../components/amount-invested/amount-invested.component';
import { ExpensesComponent } from '../components/expenses/expenses.component';
import { LossesComponent } from '../components/losses/losses.component';
import { ReserveComponent } from '../components/reserve/reserve.component';
import { PaymentComponent } from '../components/payment/payment.component';
import { PaymentSavingsComponent } from '../components/payment-savings/payment-savings.component';
import { PaymentCardComponent } from '../card/payment-card/payment-card.component';
import { RemoveCardComponent } from '../card/remove-card/remove-card.component';
import { WithdrawSavingsComponent } from '../components/withdraw-savings/withdraw-savings.component';
import { RequestSavingsWithdrawComponent } from '../components/request-savings-withdraw/request-savings-withdraw.component';
import { PaymentActivityComponent } from '../components/payment-activity/payment-activity.component';
import { PaymentCycleActivityComponent } from '../components/payment-cycle-activity/payment-cycle-activity.component';
import { SavingActivityComponent } from '../components/saving-activity/saving-activity.component';
import { SavingCycleActivityComponent } from '../components/saving-cycle-activity/saving-cycle-activity.component';
import { PaymentActivityCardComponent } from '../card/payment-activity-card/payment-activity-card.component';
import { ReturnClientCardComponent } from '../components/return-client-card/return-client-card.component';
import { RequestClientCardComponent } from '../card/request-client-card/request-client-card.component';
import { DebtCycleComponent } from '../components/debt-cycle/debt-cycle.component';
import { RequestUpdateComponent } from '../components/request-update/request-update.component';
import { TransformRegisterClientComponent } from '../components/transform-register-client/transform-register-client.component';
import { CardCycleComponent } from '../components/card-cycle/card-cycle.component';
import { UpdateClientInfoComponent } from '../components/update-client-info/update-client-info.component';
import { DailyPaymentsComponent } from '../components/daily-payments/daily-payments.component';
import { DailyCardPaymentsComponent } from '../card/daily-card-payments/daily-card-payments.component';
import { DailyLendingsComponent } from '../components/daily-lendings/daily-lendings.component';
import { DailySavingsComponent } from '../components/daily-savings/daily-savings.component';
import { DailySavingsReturnsComponent } from '../components/daily-savings-returns/daily-savings-returns.component';
import { DailyCardReturnsComponent } from '../card/daily-card-returns/daily-card-returns.component';
import { DailyReturnsComponent } from '../components/daily-returns/daily-returns.component';
import { DailyFeesComponent } from '../components/daily-fees/daily-fees.component';
import { RequestTomorrowComponent } from '../components/request-tomorrow/request-tomorrow.component';
import { RequestTodayComponent } from '../components/request-today/request-today.component';
import { PayTodayComponent } from '../components/pay-today/pay-today.component';
import { GestionDayComponent } from '../gestion/gestion-day/gestion-day.component';
import { GestionReserveComponent } from '../gestion/gestion-reserve/gestion-reserve.component';
import { GestionServedComponent } from '../gestion/gestion-served/gestion-served.component';
import { GestionExpenseComponent } from '../gestion/gestion-expense/gestion-expense.component';
import { GestionBankComponent } from '../gestion/gestion-bank/gestion-bank.component';
import { GestionLossComponent } from '../gestion/gestion-loss/gestion-loss.component';
import { GestionInvestmentComponent } from '../gestion/gestion-investment/gestion-investment.component';
import { GestionMonthComponent } from '../gestion/gestion-month/gestion-month.component';
import { PaidDateComponent } from '../components/paid-date/paid-date.component';
import { LendingDateComponent } from '../components/lending-date/lending-date.component';
import { NotPaidTodayComponent } from '../components/not-paid-today/not-paid-today.component';
import { NotPaidComponent } from '../components/not-paid/not-paid.component';
import { TeamPageComponent } from '../components/team-page/team-page.component';
import { TeamRankingMonthComponent } from '../central/team-ranking-month/team-ranking-month.component';
import { CertificateComponent } from '../components/certificate/certificate.component';
import { TutorialComponent } from '../components/tutorial/tutorial.component';
import { ReviewsComponent } from '../components/reviews/reviews.component';
import { QuestionsComponent } from '../components/questions/questions.component';

const routes: Routes = [
  {
    path: 'home',
    component: InvestementsSummaryComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'home-central',
    component: HomeCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'benefit',
    component: BenefitComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking',
    component: TrackingComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-central',
    component: TrackingCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-month',
    component: TrackingMonthComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-month-central',
    component: TrackingMonthCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-card-month',
    component: TrackingCardMonthComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-card-month-central',
    component: TrackingCardMonthCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today',
    component: TodayComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today-central',
    component: TodayCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today-card',
    component: TodayCardComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today-card-central',
    component: TodayCardCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'retrace',
    component: RetraceComponent,
    canActivate: [AuthGuard],
  },
  { path: 'client-info', component: ClientInfoComponent },
  { path: 'info-register', component: InfoRegisterComponent },
  { path: 'summary-card', component: SummaryCardComponent },
  { path: 'summary-card-central', component: SummaryCardCentralComponent },
  { path: 'client-info-current', component: ClientInfoCurrentComponent },
  { path: 'client-info-savings', component: ClientInfoSavingsComponent },
  {
    path: 'client-info-card/all',
    component: ClientInfoCardComponent,
    data: { filter: 'all' },
  },
  {
    path: 'client-info-card/current',
    component: ClientInfoCardComponent,
    data: { filter: 'current' },
  },
  {
    path: 'client-info-card/finished',
    component: ClientInfoCardComponent,
    data: { filter: 'finished' },
  },
  { path: 'new-client', component: NewClientComponent },
  { path: 'register-client', component: RegisterClientComponent },
  { path: 'new-cycle-register/:id', component: NewCycleRegisterComponent },
  { path: 'new-card', component: NewCardComponent },
  { path: 'client-portal/:id', component: ClientPortalComponent },
  { path: 'client-cycle/:id', component: ClientCycleComponent },
  { path: 'finished-debt', component: FinishedDebtComponent },
  { path: 'register-portal/:id', component: RegiserPortalComponent },
  { path: 'client-portal-card/:id', component: ClientPortalCardComponent },
  { path: 'add-investment', component: AmountInvestedComponent },
  { path: 'add-expense', component: ExpensesComponent },
  { path: 'add-loss', component: LossesComponent },
  { path: 'add-reserve', component: ReserveComponent },
  { path: 'payment/:id', component: PaymentComponent },
  { path: 'payment-savings/:id', component: PaymentSavingsComponent },
  { path: 'payment-card/:id', component: PaymentCardComponent },
  { path: 'remove-card/:id', component: RemoveCardComponent },
  { path: 'withdraw-savings/:id', component: WithdrawSavingsComponent },
  {
    path: 'request-savings-withdraw/:id',
    component: RequestSavingsWithdrawComponent,
  },
  { path: 'payment-activity/:id', component: PaymentActivityComponent },
  {
    path: 'payment-cycle-activity/:id',
    component: PaymentCycleActivityComponent,
  },
  { path: 'saving-activity/:id', component: SavingActivityComponent },
  {
    path: 'saving-cycle-activity/:id',
    component: SavingCycleActivityComponent,
  },
  {
    path: 'payment-activity-card/:id',
    component: PaymentActivityCardComponent,
  },
  {
    path: 'return-client-card/:id',
    component: ReturnClientCardComponent,
  },
  {
    path: 'request-client-card/:id',
    component: RequestClientCardComponent,
  },
  { path: 'debt-cycle/:id', component: DebtCycleComponent },
  { path: 'request-update/:id', component: RequestUpdateComponent },
  {
    path: 'transform-register-client/:id',
    component: TransformRegisterClientComponent,
  },
  { path: 'card-cycle/:id', component: CardCycleComponent },
  { path: 'update-client-info/:id', component: UpdateClientInfoComponent },
  { path: 'daily-payments', component: DailyPaymentsComponent },
  { path: 'daily-card-payments', component: DailyCardPaymentsComponent },
  { path: 'daily-lendings', component: DailyLendingsComponent },
  { path: 'daily-savings', component: DailySavingsComponent },
  { path: 'daily-savings-returns', component: DailySavingsReturnsComponent },
  { path: 'daily-card-returns', component: DailyCardReturnsComponent },
  { path: 'daily-returns', component: DailyReturnsComponent },
  { path: 'daily-fees', component: DailyFeesComponent },
  { path: 'request-tomorrow', component: RequestTomorrowComponent },
  { path: 'request-today', component: RequestTodayComponent },
  { path: 'pay-today', component: PayTodayComponent },
  { path: 'gestion-today', component: GestionDayComponent },
  { path: 'gestion-reserve', component: GestionReserveComponent },
  { path: 'gestion-served', component: GestionServedComponent },
  { path: 'gestion-expenses', component: GestionExpenseComponent },
  { path: 'gestion-bank', component: GestionBankComponent },
  { path: 'gestion-loss', component: GestionLossComponent },
  { path: 'gestion-investment', component: GestionInvestmentComponent },
  { path: 'gestion-month', component: GestionMonthComponent },
  { path: 'paid-date', component: PaidDateComponent },
  { path: 'lending-date', component: LendingDateComponent },
  { path: 'not-paid-today', component: NotPaidTodayComponent },
  { path: 'not-paid', component: NotPaidComponent },
  { path: 'team-page', component: TeamPageComponent },
  { path: 'team-ranking-month', component: TeamRankingMonthComponent },
  { path: 'certificate', component: CertificateComponent },
  { path: 'tutorial', component: TutorialComponent },
  { path: 'reviews', component: ReviewsComponent },
  { path: 'questions', component: QuestionsComponent },
  {
    path: 'employee-page',
    loadChildren: () =>
      import('../shrink/shrink.module').then((m) => m.ShrinkModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProtectedRoutingModule {}
