import { Directive, ElementRef, forwardRef, HostListener, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Keeps both the telephone input and its Angular form value at ten digits maximum. */
@Directive({
  selector: 'input[appTenDigitPhone]',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TenDigitPhoneDirective),
    multi: true,
  }],
})
export class TenDigitPhoneDirective implements ControlValueAccessor {
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private element: ElementRef<HTMLInputElement>,
    private renderer: Renderer2
  ) {}

  writeValue(value: string | null | undefined): void {
    // Keep stored numbers visible for correction rather than silently changing them on load.
    this.renderer.setProperty(this.element.nativeElement, 'value', value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.renderer.setProperty(this.element.nativeElement, 'disabled', disabled);
  }

  @HostListener('input')
  onInput(): void {
    const input = this.element.nativeElement;
    this.updateValue(input.value, input.selectionStart ?? input.value.length);
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (!event.clipboardData) return;
    event.preventDefault();
    const input = this.element.nativeElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const digits = event.clipboardData.getData('text').replace(/[^0-9]/g, '');
    const available = Math.max(0, 10 - (input.value.length - (end - start)));
    const inserted = digits.slice(0, available);
    this.updateValue(
      input.value.slice(0, start) + inserted + input.value.slice(end),
      start + inserted.length
    );
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  private updateValue(value: string, cursor: number): void {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 10);
    const nextCursor = Math.min(10, value.slice(0, cursor).replace(/[^0-9]/g, '').length);
    const input = this.element.nativeElement;
    this.renderer.setProperty(input, 'value', digits);
    input.setSelectionRange(nextCursor, nextCursor);
    this.onChange(digits);
  }
}
