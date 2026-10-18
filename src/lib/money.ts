import { getLocales } from 'expo-localization';

import { isKnownCurrency, minorUnitDigits } from './currencies';

export function deviceLocale(): string {
  try {
    return getLocales()[0]?.languageTag ?? 'en-US';
  } catch {
    return 'en-US';
  }
}

/** Default currency for new items, from the device locale. */
export function deviceCurrency(): string {
  try {
    const code = getLocales()[0]?.currencyCode;
    if (code && isKnownCurrency(code)) return code.toUpperCase();
  } catch {
    // fall through
  }
  return 'USD';
}

/** Formats integer minor units in the item's own currency, e.g. 3500 USD → "$35.00". */
export function formatMoney(minor: number, currency: string, locale = deviceLocale()): string {
  const digits = minorUnitDigits(currency);
  const value = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}

/** The currency's symbol as the device locale writes it ("$", "¥", "HK$"). */
export function currencySymbol(currency: string, locale = deviceLocale()): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Formats a price field as the user types: keeps digits and one decimal point,
 * caps the fraction at the currency's minor units, and groups thousands.
 * "1234.567" (USD) → "1,234.56"; "1500.5" (JPY) → "1,500".
 */
export function formatPriceInput(raw: string, currency: string): string {
  const digits = minorUnitDigits(currency);
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  let whole = dot === -1 ? cleaned : cleaned.slice(0, dot);
  let fraction = dot === -1 ? '' : cleaned.slice(dot + 1).replace(/\./g, '');
  whole = whole.replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (digits === 0 || dot === -1) return grouped;
  fraction = fraction.slice(0, digits);
  return `${grouped || '0'}.${fraction}`;
}

/** Parses a price field into integer minor units; empty → undefined. */
export function parsePriceInput(text: string, currency: string): number | undefined {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return undefined;
  const digits = minorUnitDigits(currency);
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const padded = (fraction + '0'.repeat(digits)).slice(0, digits);
  return Number(whole || '0') * 10 ** digits + Number(padded || '0');
}

/** Minor units back into the editable field text. */
export function minorToInput(minor: number | undefined, currency: string): string {
  if (minor === undefined || minor === null) return '';
  const digits = minorUnitDigits(currency);
  const whole = Math.floor(minor / 10 ** digits);
  const fraction = digits ? String(minor % 10 ** digits).padStart(digits, '0') : '';
  return formatPriceInput(digits ? `${whole}.${fraction}` : String(whole), currency);
}
