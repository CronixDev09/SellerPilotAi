import { CurrencyCode } from '../../../shared/types';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'AU$',
  JPY: '¥',
};

export function formatCurrency(paise: number = 0, currency: CurrencyCode = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';
  const units = paise / 100;

  if (currency === 'INR') {
    // Indian numbering format (e.g., 1,84,650)
    const hasDecimal = paise % 100 !== 0;
    const formatted = units.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimal ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  }

  const hasDecimal = paise % 100 !== 0;
  return `${symbol}${units.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(num: number = 0): string {
  return num.toLocaleString('en-IN');
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
