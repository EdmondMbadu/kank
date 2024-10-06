import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
// import { provideFirebaseApp, getApp, initializeApp } from '@angular/fire/app';
// import { provideAuth, getAuth } from '@angular/fire/auth';

import * as PlotlyJS from 'plotly.js-dist-min';
PlotlyModule.plotlyjs = PlotlyJS;

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { InvestementsSummaryComponent } from './components/investements-summary/investements-summary.component';
import { ClientInfoComponent } from './components/client-info/client-info.component';
import { NewClientComponent } from './components/new-client/new-client.component';
import { ClientPortalComponent } from './components/client-portal/client-portal.component';
import { PaymentComponent } from './components/payment/payment.component';
import { PaymentActivityComponent } from './components/payment-activity/payment-activity.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { CreateAccountComponent } from './components/create-account/create-account.component';
import { environment } from '../../environments/environments';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { DebtCycleComponent } from './components/debt-cycle/debt-cycle.component';
import { WithdrawSavingsComponent } from './components/withdraw-savings/withdraw-savings.component';
import { AmountInvestedComponent } from './components/amount-invested/amount-invested.component';
import { ExpensesComponent } from './components/expenses/expenses.component';
import { ReserveComponent } from './components/reserve/reserve.component';
import { UpdateClientInfoComponent } from './components/update-client-info/update-client-info.component';
import { DailyPaymentsComponent } from './components/daily-payments/daily-payments.component';
import { DailyLendingsComponent } from './components/daily-lendings/daily-lendings.component';
import { CommonModule } from '@angular/common';
import { PlotlyModule } from 'angular-plotly.js';
import { PayTodayComponent } from './components/pay-today/pay-today.component';
import { PaidDateComponent } from './components/paid-date/paid-date.component';
import { NotPaidTodayComponent } from './components/not-paid-today/not-paid-today.component';
import { LendingDateComponent } from './components/lending-date/lending-date.component';
import { NotPaidComponent } from './components/not-paid/not-paid.component';
import { TeamPageComponent } from './components/team-page/team-page.component';
import { EmployeePageComponent } from './shrink/employee-page/employee-page.component';
import { BenefitComponent } from './components/benefit/benefit.component';
import { TrackingComponent } from './components/tracking/tracking.component';
import { TodayComponent } from './components/today/today.component';
import { RetraceComponent } from './components/retrace/retrace.component';
import { TrackingMonthComponent } from './components/tracking-month/tracking-month.component';
import { ClientInfoCurrentComponent } from './components/client-info-current/client-info-current.component';
import { NewCardComponent } from './components/new-card/new-card.component';
import { ClientInfoCardComponent } from './card/client-info-card/client-info-card.component';
import { ClientPortalCardComponent } from './card/client-portal-card/client-portal-card.component';
import { PaymentCardComponent } from './components/payment-card/payment-card.component';
import { PaymentActivityCardComponent } from './components/payment-activity-card/payment-activity-card.component';
import { ReturnClientCardComponent } from './components/return-client-card/return-client-card.component';
import { CardCycleComponent } from './components/card-cycle/card-cycle.component';
import { SummaryCardComponent } from './card/summary-card/summary-card.component';
import { TodayCardComponent } from './card/today-card/today-card.component';
import { TrackingCardMonthComponent } from './card/tracking-card-month/tracking-card-month.component';
import { HomeCentralComponent } from './central/home-central/home-central.component';
import { TrackingCentralComponent } from './central/tracking-central/tracking-central.component';
import { TodayCentralComponent } from './central/today-central/today-central.component';
import { TrackingMonthCentralComponent } from './central/tracking-month-central/tracking-month-central.component';
import { TodayCardCentralComponent } from './central/today-card-central/today-card-central.component';
import { TrackingCardMonthCentralComponent } from './central/tracking-card-month-central/tracking-card-month-central.component';
import { SummaryCardCentralComponent } from './central/summary-card-central/summary-card-central.component';
import { RegisterClientComponent } from './components/register-client/register-client.component';
import { InfoRegisterComponent } from './components/info-register/info-register.component';
// import { RegiserPortalComponent } from './components/register-portal/register-portal.component';
import { TransformRegisterClientComponent } from './components/transform-register-client/transform-register-client.component';
import { RegiserPortalComponent } from './components/register-portal/register-portal.component';
import { RemoveCardComponent } from './card/remove-card/remove-card.component';
import { CertificateComponent } from './components/certificate/certificate.component';
import { TeamRankingMonthComponent } from './central/team-ranking-month/team-ranking-month.component';
import { SavingActivityComponent } from './components/saving-activity/saving-activity.component';
import { DailySavingsComponent } from './components/daily-savings/daily-savings.component';
import { NewCycleRegisterComponent } from './components/new-cycle-register/new-cycle-register.component';
import { RequestTomorrowComponent } from './components/request-tomorrow/request-tomorrow.component';
import { RequestSavingsWithdrawComponent } from './components/request-savings-withdraw/request-savings-withdraw.component';
import { RequestClientCardComponent } from './card/request-client-card/request-client-card.component';
import { RequestTodayComponent } from './components/request-today/request-today.component';
import { RequestUpdateComponent } from './components/request-update/request-update.component';
import { DailyFeesComponent } from './components/daily-fees/daily-fees.component';
import { DailySavingsReturnsComponent } from './components/daily-savings-returns/daily-savings-returns.component';
import { GestionDayComponent } from './gestion/gestion-day/gestion-day.component';
import { GestionMonthComponent } from './gestion/gestion-month/gestion-month.component';
import { GestionReserveComponent } from './gestion/gestion-reserve/gestion-reserve.component';
import { GestionExpenseComponent } from './gestion/gestion-expense/gestion-expense.component';
import { GestionServedComponent } from './gestion/gestion-served/gestion-served.component';
import { GestionBankComponent } from './gestion/gestion-bank/gestion-bank.component';
import { GestionLossComponent } from './gestion/gestion-loss/gestion-loss.component';
import { GestionInvestmentComponent } from './gestion/gestion-investment/gestion-investment.component';
import { TutorialComponent } from './components/tutorial/tutorial.component';
import { LossesComponent } from './components/losses/losses.component';
import { DailyReturnsComponent } from './components/daily-returns/daily-returns.component';
import { DailyCardPaymentsComponent } from './card/daily-card-payments/daily-card-payments.component';
import { DailyCardReturnsComponent } from './card/daily-card-returns/daily-card-returns.component';
import { SharedModule } from './shared/shared.module';

@NgModule({
  declarations: [
    AppComponent,
    // NavbarComponent,
    LandingPageComponent,
    InvestementsSummaryComponent,
    ClientInfoComponent,
    NewClientComponent,
    ClientPortalComponent,
    PaymentComponent,
    PaymentActivityComponent,
    ForgotPasswordComponent,
    CreateAccountComponent,
    VerifyEmailComponent,
    DebtCycleComponent,
    WithdrawSavingsComponent,
    AmountInvestedComponent,
    ExpensesComponent,
    ReserveComponent,
    UpdateClientInfoComponent,
    DailyPaymentsComponent,
    DailyLendingsComponent,
    PayTodayComponent,
    PaidDateComponent,
    NotPaidTodayComponent,
    LendingDateComponent,
    NotPaidComponent,
    TeamPageComponent,
    // EmployeePageComponent,
    BenefitComponent,
    TrackingComponent,
    TodayComponent,
    RetraceComponent,
    TrackingMonthComponent,
    ClientInfoCurrentComponent,
    NewCardComponent,
    ClientInfoCardComponent,
    ClientPortalCardComponent,
    PaymentCardComponent,
    PaymentActivityCardComponent,
    ReturnClientCardComponent,
    CardCycleComponent,
    SummaryCardComponent,
    TodayCardComponent,
    TrackingCardMonthComponent,
    HomeCentralComponent,
    HomeCentralComponent,
    TrackingCentralComponent,
    TodayCentralComponent,
    TrackingMonthCentralComponent,
    TodayCardCentralComponent,
    TrackingCardMonthCentralComponent,
    SummaryCardCentralComponent,
    RegisterClientComponent,
    InfoRegisterComponent,
    RegiserPortalComponent,
    // RegiserPortalComponent,
    TransformRegisterClientComponent,
    RemoveCardComponent,
    CertificateComponent,
    TeamRankingMonthComponent,
    SavingActivityComponent,
    DailySavingsComponent,
    NewCycleRegisterComponent,
    RequestTomorrowComponent,
    RequestSavingsWithdrawComponent,
    RequestClientCardComponent,
    RequestTodayComponent,
    RequestUpdateComponent,
    DailyFeesComponent,
    DailySavingsReturnsComponent,
    GestionDayComponent,
    GestionMonthComponent,
    GestionReserveComponent,
    GestionExpenseComponent,
    GestionServedComponent,
    GestionBankComponent,
    GestionLossComponent,
    GestionInvestmentComponent,
    TutorialComponent,
    LossesComponent,
    DailyReturnsComponent,
    DailyCardPaymentsComponent,
    DailyCardReturnsComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    CommonModule,
    PlotlyModule,
    SharedModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
