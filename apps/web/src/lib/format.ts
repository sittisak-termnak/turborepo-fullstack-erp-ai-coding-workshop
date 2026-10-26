/**
 * The display rules of TOR section 6.2, in one place: dates and times on the Asia/Bangkok clock,
 * monetary amounts to exactly two decimal places. Screens call these instead of formatting inline,
 * so the rules are implemented and proven once rather than per screen.
 *
 * Timestamps are stored in UTC and converted here using the named zone, never a fixed offset, so
 * the output is the same on a developer's laptop, in CI and on the server.
 *
 * The calendar is pinned to Gregorian rather than letting the Thai locale default to the Buddhist
 * era, because the stored data, the API and the CSV export all use Gregorian years and a silent
 * 543-year shift on screen only would be a reporting hazard.
 */

export const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const THAI_LOCALE = 'th-TH-u-ca-gregory';

const dateTimeFormat = new Intl.DateTimeFormat(THAI_LOCALE, {
  timeZone: BANGKOK_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const dateFormat = new Intl.DateTimeFormat(THAI_LOCALE, {
  timeZone: BANGKOK_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat(THAI_LOCALE, {
  timeZone: BANGKOK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A date and time on the Bangkok clock, e.g. `16 ม.ค. 2026 00:30`. */
export function formatDateTime(instant: string | Date): string {
  return dateTimeFormat.format(new Date(instant));
}

/** A calendar day on the Bangkok clock, e.g. `16 ม.ค. 2026`. */
export function formatDate(instant: string | Date): string {
  return dateFormat.format(new Date(instant));
}

/** A time of day on the Bangkok clock, e.g. `00:30`. */
export function formatTime(instant: string | Date): string {
  return timeFormat.format(new Date(instant));
}

/** A monetary amount with exactly two decimal places, e.g. `1,234.50`. */
export function formatMoney(amount: number): string {
  return moneyFormat.format(amount);
}
