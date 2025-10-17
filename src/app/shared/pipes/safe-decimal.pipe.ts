import { DecimalPipe } from '@angular/common';
import { Inject, Injectable, LOCALE_ID } from '@angular/core';
import { coerceToNumber } from 'src/app/utils/number-utils';

@Injectable()
export class SafeDecimalPipe extends DecimalPipe {
  constructor(@Inject(LOCALE_ID) locale: string) {
    super(locale);
  }

  override transform(
    value: string | number,
    digitsInfo?: string,
    locale?: string
  ): string | null;
  override transform(
    value: null | undefined,
    digitsInfo?: string,
    locale?: string
  ): null;
  override transform(
    value: string | number | null | undefined,
    digitsInfo?: string,
    locale?: string
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numericValue = coerceToNumber(value);

    if (numericValue === null) {
      return super.transform(0, digitsInfo, locale);
    }

    return super.transform(numericValue, digitsInfo, locale);
  }
}
