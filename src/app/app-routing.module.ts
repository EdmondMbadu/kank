import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { InvestementsSummaryComponent } from './components/investements-summary/investements-summary.component';
import { ClientInfoComponent } from './components/client-info/client-info.component';
import { NewClientComponent } from './components/new-client/new-client.component';
import { ClientPortalComponent } from './components/client-portal/client-portal.component';
import { PaymentComponent } from './components/payment/payment.component';
import { PaymentActivityComponent } from './components/payment-activity/payment-activity.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { CreateAccountComponent } from './components/create-account/create-account.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { AuthGuard } from './services/auth.guard';
import { DebtCycleComponent } from './components/debt-cycle/debt-cycle.component';
import { WithdrawSavingsComponent } from './components/withdraw-savings/withdraw-savings.component';
import { AmountInvestedComponent } from './components/amount-invested/amount-invested.component';
import { ExpensesComponent } from './components/expenses/expenses.component';
import { ReserveComponent } from './components/reserve/reserve.component';
import { UpdateClientInfoComponent } from './components/update-client-info/update-client-info.component';
import { DailyPaymentsComponent } from './components/daily-payments/daily-payments.component';
import { DailyLendingsComponent } from './components/daily-lendings/daily-lendings.component';
import { PayTodayComponent } from './components/pay-today/pay-today.component';
import { PaidDateComponent } from './components/paid-date/paid-date.component';
import { NotPaidTodayComponent } from './components/not-paid-today/not-paid-today.component';
import { LendingDateComponent } from './components/lending-date/lending-date.component';
import { NotPaidComponent } from './components/not-paid/not-paid.component';
import { TeamPageComponent } from './components/team-page/team-page.component';
import { EmployeePageComponent } from './components/employee-page/employee-page.component';
import { BenefitComponent } from './components/benefit/benefit.component';
import { TrackingComponent } from './components/tracking/tracking.component';
import { TodayComponent } from './components/today/today.component';
import { RetraceComponent } from './components/retrace/retrace.component';
import { TrackingMonthComponent } from './components/tracking-month/tracking-month.component';
import { ClientInfoCurrentComponent } from './components/client-info-current/client-info-current.component';
import { NewCardComponent } from './components/new-card/new-card.component';
import { ClientInfoCardComponent } from './components/client-info-card/client-info-card.component';
import { ClientPortalCardComponent } from './components/client-portal-card/client-portal-card.component';
import { PaymentCardComponent } from './components/payment-card/payment-card.component';
import { PaymentActivityCardComponent } from './components/payment-activity-card/payment-activity-card.component';
import { ReturnClientCardComponent } from './components/return-client-card/return-client-card.component';
import { CardCycleComponent } from './components/card-cycle/card-cycle.component';
import { SummaryCardComponent } from './card/summary-card/summary-card.component';
import { TodayCardComponent } from './card/today-card/today-card.component';
import { TrackingCardMonthComponent } from './card/tracking-card-month/tracking-card-month.component';

const routes: Routes = [
  { path: '', component: LandingPageComponent },
  {
    path: 'home',
    component: InvestementsSummaryComponent,
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
    path: 'tracking-month',
    component: TrackingMonthComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-card-month',
    component: TrackingCardMonthComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today',
    component: TodayComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today-card',
    component: TodayCardComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'retrace',
    component: RetraceComponent,
    canActivate: [AuthGuard],
  },
  { path: 'client-info', component: ClientInfoComponent },
  { path: 'summary-card', component: SummaryCardComponent },
  { path: 'client-info-current', component: ClientInfoCurrentComponent },
  { path: 'client-info-card', component: ClientInfoCardComponent },
  { path: 'new-client', component: NewClientComponent },
  { path: 'new-card', component: NewCardComponent },
  { path: 'client-portal/:id', component: ClientPortalComponent },
  { path: 'client-portal-card/:id', component: ClientPortalCardComponent },
  { path: 'add-investment', component: AmountInvestedComponent },
  { path: 'add-expense', component: ExpensesComponent },
  { path: 'add-reserve', component: ReserveComponent },
  { path: 'payment/:id', component: PaymentComponent },
  { path: 'payment-card/:id', component: PaymentCardComponent },
  { path: 'withdraw-savings/:id', component: WithdrawSavingsComponent },
  { path: 'payment-activity/:id', component: PaymentActivityComponent },
  {
    path: 'payment-activity-card/:id',
    component: PaymentActivityCardComponent,
  },
  {
    path: 'return-client-card/:id',
    component: ReturnClientCardComponent,
  },

  { path: 'debt-cycle/:id', component: DebtCycleComponent },
  { path: 'card-cycle/:id', component: CardCycleComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'create-account', component: CreateAccountComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'update-client-info/:id', component: UpdateClientInfoComponent },
  { path: 'daily-payments', component: DailyPaymentsComponent },
  { path: 'daily-lendings', component: DailyLendingsComponent },
  { path: 'pay-today', component: PayTodayComponent },
  { path: 'paid-date', component: PaidDateComponent },
  { path: 'lending-date', component: LendingDateComponent },
  { path: 'not-paid-today', component: NotPaidTodayComponent },
  { path: 'not-paid', component: NotPaidComponent },
  { path: 'team-page', component: TeamPageComponent },
  { path: 'employee-page/:id', component: EmployeePageComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
