import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney } from './format';

// The tests run with TZ=UTC (see vite.config.ts), so an instant late in the UTC day lands on the
// next Bangkok day. A formatter that forgot the zone would print 15 January and 17:30 instead.
const lateUtcEvening = '2026-01-15T17:30:00.000Z';

describe('formatDateTime', () => {
  it('renders an instant on the Bangkok clock, not the host clock', () => {
    const formatted = formatDateTime(lateUtcEvening);

    expect(formatted).toContain('00:30');
    expect(formatted).toContain('16');
    expect(formatted).not.toContain('17:30');
    expect(formatted).not.toContain('15');
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(formatDateTime(new Date(lateUtcEvening))).toBe(formatDateTime(lateUtcEvening));
  });
});

describe('formatDate', () => {
  it('renders the Bangkok calendar day without a time', () => {
    const formatted = formatDate(lateUtcEvening);

    expect(formatted).toContain('16');
    expect(formatted).not.toContain('00:30');
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
