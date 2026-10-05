import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SafeNumberPipe } from './pipes/safe-number.pipe';
import { SafeDecimalPipe } from './pipes/safe-decimal.pipe';
import { TenDigitPhoneDirective } from './directives/ten-digit-phone.directive';

@NgModule({
  declarations: [NavbarComponent, SafeNumberPipe, TenDigitPhoneDirective],
  imports: [CommonModule, RouterModule, FormsModule],
  exports: [NavbarComponent, SafeNumberPipe, TenDigitPhoneDirective],
  providers: [{ provide: DecimalPipe, useClass: SafeDecimalPipe }],
})
export class SharedModule {}
