import { PriceInfo } from '../models';
import { formatMoney, pinLabel, priceLabel } from './price';

const info = (label: PriceInfo['label'], amount: number | null): PriceInfo => ({ label, amount, currency: 'MAD', model: 'fixed' });

describe('price formatting never conflates pricing models', () => {
  it('formats money per currency', () => {
    expect(formatMoney(1500, 'MAD')).toBe('1,500 MAD');
    expect(formatMoney(20, 'EUR')).toBe('€20');
    expect(formatMoney(null)).toBe('—');
  });
  it('labels fixed, starting, hourly and quote distinctly', () => {
    expect(priceLabel(info('fixed', 800))).toBe('800 MAD');
    expect(priceLabel(info('from', 800))).toBe('From 800 MAD');
    expect(priceLabel(info('per_hour', 300))).toBe('300 MAD / hour');
    expect(priceLabel(info('quote', null))).toBe('Custom quote');
  });
  it('builds compact map-pin labels', () => {
    expect(pinLabel(info('fixed', 800))).toBe('800');
    expect(pinLabel(info('from', 800))).toBe('800+');
    expect(pinLabel(info('per_hour', 300))).toBe('300/h');
    expect(pinLabel(info('quote', null))).toBe('Quote');
  });
});
