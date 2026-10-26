import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { APP_ERRORS } from '@erp/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
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

  it('shows the shared Thai message when the API cannot be reached', async () => {
    mockApi({});

    renderWithQueryClient(<HealthStatus />);

    // The query client retries once before giving up, so this outlasts the retry delay.
    expect(
      await screen.findByText(APP_ERRORS.UNREACHABLE.message, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
