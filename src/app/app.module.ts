import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
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

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
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
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    CommonModule,
    PlotlyModule,
    // provideFirebaseApp(() => initializeApp(environment.firebase)),
    // provideAuth(() => getAuth()),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
