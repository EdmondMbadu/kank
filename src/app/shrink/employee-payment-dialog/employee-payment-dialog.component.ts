import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter,
  HostListener, Inject, Input, OnDestroy, Output, ViewChild,
} from '@angular/core';
import { EmployeePaymentSummary, paymentNumber } from './employee-payment-summary';
import { EmployeeBonusSummary } from './employee-bonus-summary';

@Component({
  selector: 'app-employee-payment-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-payment-dialog.component.html',
  styleUrls: ['./employee-payment-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeePaymentDialogComponent implements AfterViewInit, OnDestroy {
  @Input() summary!: EmployeePaymentSummary | EmployeeBonusSummary;
  @Input() busy = false;
  @Output() dismissed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLElement>;
  @ViewChild('closeButton', { static: true }) closeButton!: ElementRef<HTMLButtonElement>;
  detailsOpen = false;
  number = paymentNumber;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';

  constructor(@Inject(DOCUMENT) private document: Document) {}

  get isBonus(): boolean {
    return 'kind' in this.summary && this.summary.kind === 'bonus';
  }

  get paymentSummary(): EmployeePaymentSummary | null {
    return 'kind' in this.summary ? null : this.summary;
  }

  get dialogId(): string {
    return this.isBonus ? 'employee-bonus' : 'employee-payment';
  }

  ngAfterViewInit(): void {
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.closeButton.nativeElement.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousOverflow;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }

  dismiss(): void {
    if (!this.busy) this.dismissed.emit();
  }

  confirm(): void {
    if (!this.busy) this.confirmed.emit();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dismiss();
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && (this.document.activeElement === first || this.document.activeElement === this.dialog.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
