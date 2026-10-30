import { Currency, PriceInfo, PricingModel } from '../models';

export function formatMoney(amount: number | null | undefined, currency: Currency = 'MAD'): string {
  if (amount == null) return '—';
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
  return currency === 'MAD' ? `${n} MAD` : currency === 'EUR' ? `€${n}` : `$${n}`;
}

export function priceLabel(p: PriceInfo): string {
  switch (p.label) {
    case 'quote': return 'Custom quote';
    case 'per_hour': return `${formatMoney(p.amount, p.currency)} / hour`;
    case 'from': return `From ${formatMoney(p.amount, p.currency)}`;
    default: return formatMoney(p.amount, p.currency);
  }
}
/** Compact text used on map pins, e.g. "800" / "300/h" / "Quote". */
export function pinLabel(p: PriceInfo): string {
  if (p.label === 'quote') return 'Quote';
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(p.amount ?? 0);
  return p.label === 'per_hour' ? `${n}/h` : p.label === 'from' ? `${n}+` : n;
}
export const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  fixed: 'Fixed price', hourly: 'Hourly rate', starting: 'Starting price', quote: 'Custom quote',
};
