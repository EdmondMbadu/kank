import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
// import { provideAuth, getAuth } from '@angular/fire/auth';

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
import { NgApexchartsModule } from 'ng-apexcharts';
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
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';

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
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgApexchartsModule,
    ReactiveFormsModule,
    FormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // provideAuth(() => getAuth()),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
