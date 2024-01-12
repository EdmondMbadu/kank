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
    path: 'today',
    component: TodayComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'retrace',
    component: RetraceComponent,
    canActivate: [AuthGuard],
  },
  { path: 'client-info', component: ClientInfoComponent },
  { path: 'new-client', component: NewClientComponent },
  { path: 'client-portal/:id', component: ClientPortalComponent },
  { path: 'add-investment', component: AmountInvestedComponent },
  { path: 'add-expense', component: ExpensesComponent },
  { path: 'add-reserve', component: ReserveComponent },
  { path: 'payment/:id', component: PaymentComponent },
  { path: 'withdraw-savings/:id', component: WithdrawSavingsComponent },
  { path: 'payment-activity/:id', component: PaymentActivityComponent },
  { path: 'debt-cycle/:id', component: DebtCycleComponent },
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
