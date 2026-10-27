import { describe, expect, it } from 'vitest';
import { formatMoney, formatTime } from './format';

// The tests run with TZ=UTC (see vite.config.ts), so an instant late in the UTC day lands on the
// next Bangkok day. A formatter that forgot the zone would print 17:30 instead.
const lateUtcEvening = '2026-01-15T17:30:00.000Z';

describe('formatTime', () => {
  it('renders the time of day on the Bangkok clock, not the host clock', () => {
    expect(formatTime(lateUtcEvening)).toBe('00:30');
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(formatTime(new Date(lateUtcEvening))).toBe('00:30');
  });
});

describe('formatMoney', () => {
  it('renders exactly two decimal places', () => {
    expect(formatMoney(0)).toBe('0.00');
    expect(formatMoney(7)).toBe('7.00');
    expect(formatMoney(12.5)).toBe('12.50');
  });

  it('groups thousands', () => {
    expect(formatMoney(1234567.89)).toBe('1,234,567.89');
  });

  it('keeps a negative amount signed', () => {
    expect(formatMoney(-42.5)).toBe('-42.50');
  });
});
