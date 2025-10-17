import { DecimalPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { coerceToNumber } from 'src/app/utils/number-utils';

@Pipe({
  name: 'safeNumber',
  pure: true,
})
export class SafeNumberPipe implements PipeTransform {
  constructor(private readonly decimalPipe: DecimalPipe) {}

  transform(
    value: unknown,
    digitsInfo?: string,
    fallback: string | number = '0',
    locale?: string
  ): string {
    const numericValue = coerceToNumber(value);

    if (numericValue === null) {
      return typeof fallback === 'number'
        ? this.decimalPipe.transform(fallback, digitsInfo, locale) ?? `${fallback}`
        : fallback;
    }

    return (
      this.decimalPipe.transform(numericValue, digitsInfo, locale) ??
      (typeof fallback === 'number' ? `${fallback}` : fallback)
    );
  }
}
