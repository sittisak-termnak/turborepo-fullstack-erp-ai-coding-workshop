import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { APP_ERRORS } from '@erp/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { HealthStatus } from './health-status';

function renderWithQueryClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);
}

function mockHealthResponse(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body)),
  );
}

const healthy = { api: 'ok', database: 'ok', timestamp: '2026-01-15T17:30:00.000Z' };

describe('HealthStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows API and database as ok, in Thai', async () => {
    mockHealthResponse(healthy);

    renderWithQueryClient(<HealthStatus />);

    expect(await screen.findByText('สถานะระบบ')).toBeInTheDocument();
    const database = (await screen.findByText('ฐานข้อมูล')).parentElement!;
    expect(await within(database).findByText('✅ ปกติ')).toBeInTheDocument();
  });

  it('shows the database as down, in Thai', async () => {
    mockHealthResponse({ ...healthy, database: 'error' });

    renderWithQueryClient(<HealthStatus />);

    const database = (await screen.findByText('ฐานข้อมูล')).parentElement!;
    expect(await within(database).findByText('❌ ไม่พร้อมใช้งาน')).toBeInTheDocument();
  });

  // The host clock is UTC in tests, so 17:30Z must read as 00:30 the next Bangkok day.
  it('shows when it last checked on the Bangkok clock', async () => {
    mockHealthResponse(healthy);

    renderWithQueryClient(<HealthStatus />);

    expect(await screen.findByText(/ตรวจสอบล่าสุด 00:30/)).toBeInTheDocument();
  });

  it('shows the shared Thai message when the request never reached the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    renderWithQueryClient(<HealthStatus />);

    // The query client retries once before giving up, so this outlasts the retry delay.
    expect(
      await screen.findByText(APP_ERRORS.UNREACHABLE.message, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  // The API's own Thai message is more specific than "check your connection", so it wins.
  it('shows the message the API returned when the API answered with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            defined: false,
            code: 'INTERNAL_SERVER_ERROR',
            status: 500,
            message: APP_ERRORS.UNEXPECTED.message,
            data: { code: 'UNEXPECTED', action: 'RETRY' },
          },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<HealthStatus />);

    expect(
      await screen.findByText(APP_ERRORS.UNEXPECTED.message, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
