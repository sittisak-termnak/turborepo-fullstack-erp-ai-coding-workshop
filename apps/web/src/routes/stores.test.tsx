import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { APP_ERRORS } from '@erp/contracts';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { StoresPage } from './stores';

const b01 = { id: 'store-b01', code: 'B01', name: 'สาขาสยาม' };
const b02 = { id: 'store-b02', code: 'B02', name: 'สาขาบางนา' };

/** The list state lives in the query string, so the page is rendered through a router. */
function renderStores(url = '/stores') {
  const router = createMemoryRouter([{ path: '/stores', element: <StoresPage /> }], {
    initialEntries: [url],
  });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const serverError = () =>
  Response.json(
    {
      defined: false,
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      message: APP_ERRORS.UNEXPECTED.message,
      data: { action: 'RETRY' },
    },
    { status: 500 },
  );

describe('StoresPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-04: four distinct states, one at a time.
  it('shows a loading state before the first page arrives', () => {
    mockApi({ 'GET /stores': { items: [b01], total: 1 } });

    renderStores();

    expect(screen.getByRole('status')).toHaveTextContent(/กำลังโหลด/);
  });

  it('shows the stores once the page arrives, with code and name', async () => {
    mockApi({ 'GET /stores': { items: [b02, b01], total: 2 } });

    renderStores();

    expect(await screen.findByText('B02')).toBeInTheDocument();
    expect(screen.getByText('สาขาบางนา')).toBeInTheDocument();
    expect(screen.getByText('B01')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // AC-05.
  it('shows a Thai empty-state message rather than a blank panel when nothing matches', async () => {
    mockApi({ 'GET /stores': { items: [], total: 0 } });

    renderStores('/stores?q=%E0%B9%84%E0%B8%A1%E0%B9%88%E0%B8%A1%E0%B8%B5');

    expect(await screen.findByText(/ไม่พบสาขา/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("shows the API's Thai message when the list request failed", async () => {
    mockApi({ 'GET /stores': serverError() });

    renderStores();

    expect(
      await screen.findByRole('alert', undefined, { timeout: 4000 }),
    ).toHaveTextContent(APP_ERRORS.UNEXPECTED.message);
  });

  it('reads the page and the filter from the query string, so a list view is shareable', async () => {
    const fetch = mockApi({ 'GET /stores': { items: [b01], total: 21 } });

    renderStores('/stores?page=2&pageSize=1&q=B01');

    await screen.findByText('B01');
    const url = new URL(fetch.mock.calls[0]![0].url);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('1');
    expect(url.searchParams.get('q')).toBe('B01');
  });

  it('says how many stores matched, so the count the API returns is visible', async () => {
    mockApi({ 'GET /stores': { items: [b01, b02], total: 2 } });

    renderStores();

    expect(await screen.findByText(/ทั้งหมด 2 สาขา/)).toBeInTheDocument();
  });
});
