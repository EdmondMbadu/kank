import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { RouterModule } from '@angular/router';

export interface FollowedClientRow {
  uid: string;
  name: string;
  debt: string;
  phone: string;
}

@Component({
  selector: 'app-followed-clients-dialog',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './followed-clients-dialog.component.html',
  styleUrls: ['./followed-clients-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowedClientsDialogComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() employeeName = '';
  @Input() rows: readonly FollowedClientRow[] = [];
  @Output() dismissed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;

  visibleRows: readonly FollowedClientRow[] = [];
  private readonly batchSize = 50;
  private visibleLimit = this.batchSize;
  private previousBodyOverflow: string | null = null;
  private openingElement: HTMLElement | null = null;

  ngOnChanges(): void {
    this.visibleRows = this.rows.slice(0, this.visibleLimit);
  }

  ngAfterViewInit(): void {
    this.openingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    this.dialog.nativeElement.showModal();
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.dialog.nativeElement.close();
    if (this.previousBodyOverflow !== null) {
      document.body.style.overflow = this.previousBodyOverflow;
    }
    if (this.openingElement?.isConnected) {
      this.openingElement.focus({ preventScroll: true });
    }
  }

  showMore(): void {
    this.visibleLimit += this.batchSize;
    this.visibleRows = this.rows.slice(0, this.visibleLimit);
  }

  close(): void {
    this.dialog.nativeElement.close();
    this.dismissed.emit();
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    const element = this.dialog.nativeElement;
    if (event.target !== element) return;
    const bounds = element.getBoundingClientRect();
    if (
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    ) {
      this.close();
    }
  }

  trackClient(_index: number, row: FollowedClientRow): string {
    return row.uid;
  }
}
