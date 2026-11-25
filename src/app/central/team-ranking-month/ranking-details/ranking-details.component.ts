import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RankingDetailsView } from '../ranking-placement.util';

@Component({
  selector: 'app-ranking-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranking-details.component.html',
})
export class RankingDetailsComponent implements AfterViewInit, OnDestroy {
  @Input() details!: RankingDetailsView;
  @Output() dismissed = new EventEmitter<void>();
  @Output() retried = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLElement>;
  readonly podium = [1, 2, 3];
  private previousFocus = document.activeElement as HTMLElement | null;
  private previousOverflow = document.body.style.overflow;

  ngAfterViewInit(): void {
    document.body.style.overflow = 'hidden';
    this.dialog.nativeElement.querySelector<HTMLElement>('button')?.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }

  daysAt(rank: number): number {
    return this.details.summary?.ranks.find((row) => row.rank === rank)?.days || 0;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dismissed.emit();
    } else if (event.key === 'Tab') {
      const controls = this.dialog.nativeElement.querySelectorAll<HTMLElement>('button, summary');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  }
}
