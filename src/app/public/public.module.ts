import { NgModule } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PublicRoutingModule } from './public-routing.module';
import { LandingPageComponent } from '../components/landing-page/landing-page.component';
import { ForgotPasswordComponent } from '../components/forgot-password/forgot-password.component';
import { CreateAccountComponent } from '../components/create-account/create-account.component';
import { VerifyEmailComponent } from '../components/verify-email/verify-email.component';
import { PublicShellComponent } from './public-shell/public-shell.component';
import { PriseContactComponent } from '../components/prise-contact/prise-contact.component';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [
    PublicShellComponent,
    LandingPageComponent,
    ForgotPasswordComponent,
    CreateAccountComponent,
    VerifyEmailComponent,
    PriseContactComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    PublicRoutingModule,
    SharedModule,
    NgOptimizedImage,
  ],
})
export class PublicModule {}
