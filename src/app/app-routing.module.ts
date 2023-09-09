import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { InvestementsSummaryComponent } from './components/investements-summary/investements-summary.component';
import { ClientInfoComponent } from './components/client-info/client-info.component';
import { NewClientComponent } from './components/new-client/new-client.component';
import { ClientPortalComponent } from './components/client-portal/client-portal.component';
import { PaymentComponent } from './components/payment/payment.component';
import { PaymentActivityComponent } from './components/payment-activity/payment-activity.component';
import { ButtonsComponent } from './tools/buttons/buttons.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { CreateAccountComponent } from './components/create-account/create-account.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { AuthGuard } from './services/auth.guard';

const routes: Routes = [
  { path: '', component: LandingPageComponent },
  {
    path: 'home',
    component: InvestementsSummaryComponent,
    canActivate: [AuthGuard],
  },
  { path: 'client-info', component: ClientInfoComponent },
  { path: 'new-client', component: NewClientComponent },
  { path: 'client-portal/:id', component: ClientPortalComponent },
  { path: 'payment/:id', component: PaymentComponent },
  { path: 'payment-activity/:id', component: PaymentActivityComponent },
  { path: 'testing', component: ButtonsComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'create-account', component: CreateAccountComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
