import { formatMoney, formatPriceInput, minorToInput, parsePriceInput } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import { minorUnitDigits } from '@/lib/currencies';

describe('money', () => {
  it('formats minor units in the item currency', () => {
    expect(formatMoney(3500, 'USD', 'en-US')).toBe('$35.00');
    expect(formatMoney(550, 'JPY', 'en-US')).toBe('¥550');
    expect(formatMoney(12345, 'KWD', 'en-US')).toMatch(/12\.345/);
  });

  it('knows minor unit exponents', () => {
    expect(minorUnitDigits('usd')).toBe(2);
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('BHD')).toBe(3);
  });

  it('formats price input as typed', () => {
    expect(formatPriceInput('1234', 'USD')).toBe('1,234');
    expect(formatPriceInput('1234.567', 'USD')).toBe('1,234.56');
    expect(formatPriceInput('1,234.5.6', 'USD')).toBe('1,234.56');
    expect(formatPriceInput('.5', 'USD')).toBe('0.5');
    expect(formatPriceInput('0012', 'USD')).toBe('12');
    expect(formatPriceInput('1500.5', 'JPY')).toBe('1,500');
    expect(formatPriceInput('abc', 'USD')).toBe('');
  });

  it('parses input into minor units and back', () => {
    expect(parsePriceInput('35', 'USD')).toBe(3500);
    expect(parsePriceInput('1,234.5', 'USD')).toBe(123450);
    expect(parsePriceInput('550', 'JPY')).toBe(550);
    expect(parsePriceInput('', 'USD')).toBeUndefined();
    expect(minorToInput(123450, 'USD')).toBe('1,234.50');
    expect(minorToInput(550, 'JPY')).toBe('550');
    expect(minorToInput(undefined, 'USD')).toBe('');
  });
});

describe('dates', () => {
  it('shows month and year', () => {
    expect(formatMonthYear('2026-08-20')).toBe('Aug 2026');
    expect(formatMonthYear('2019-12-14T10:00:00.000Z')).toBe('Dec 2019');
    expect(formatMonthYear(undefined)).toBe('');
  });
});
