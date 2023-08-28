import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { InvestementsSummaryComponent } from './components/investements-summary/investements-summary.component';
import { ClientInfoComponent } from './components/client-info/client-info.component';
import { NewClientComponent } from './components/new-client/new-client.component';
import { ClientPortalComponent } from './components/client-portal/client-portal.component';
import { PaymentComponent } from './components/payment/payment.component';
import { PaymentActivityComponent } from './components/payment-activity/payment-activity.component';

const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'investements', component: InvestementsSummaryComponent },
  { path: 'client-info', component: ClientInfoComponent },
  { path: 'new-client', component: NewClientComponent },
  { path: 'client-portal', component: ClientPortalComponent },
  { path: 'payment', component: PaymentComponent },
  { path: 'payment-activity', component: PaymentActivityComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
