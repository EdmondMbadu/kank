import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

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
import { ButtonsComponent } from './tools/buttons/buttons.component';
import { NgApexchartsModule } from 'ng-apexcharts';

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
    ButtonsComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, NgApexchartsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
