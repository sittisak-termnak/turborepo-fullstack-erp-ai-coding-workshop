import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { APP_ERRORS } from '@erp/contracts';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { SuppliersPage } from './suppliers';

const sup01 = {
  id: 'supplier-sup01',
  code: 'SUP01',
  name: 'SupplyOne Co Ltd',
  phone: null,
  address: null,
};
const sup02 = {
  id: 'supplier-sup02',
  code: 'SUP02',
  name: 'Supplier Two',
  phone: '02-111-2222',
  address: '1 ถนนสุขุมวิท',
};

/** The list state lives in the query string, so the page is rendered through a router. */
function renderSuppliers(url = '/suppliers') {
  const router = createMemoryRouter([{ path: '/suppliers', element: <SuppliersPage /> }], {
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

describe('SuppliersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state before the first page arrives', () => {
    mockApi({ 'GET /suppliers': { items: [sup01], total: 1 } });

    renderSuppliers();

    expect(screen.getByRole('status')).toHaveTextContent(/กำลังโหลด/);
  });

  it('shows the suppliers once the page arrives, with code, name and contact details', async () => {
    mockApi({ 'GET /suppliers': { items: [sup02, sup01], total: 2 } });

    renderSuppliers();

    expect(await screen.findByText('SUP02')).toBeInTheDocument();
    expect(screen.getByText('Supplier Two')).toBeInTheDocument();
    expect(screen.getByText('02-111-2222')).toBeInTheDocument();
    expect(screen.getByText('1 ถนนสุขุมวิท')).toBeInTheDocument();
    expect(screen.getByText('SUP01')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a dash for a supplier with no phone or address, the §8.1 seed shape', async () => {
    mockApi({ 'GET /suppliers': { items: [sup01], total: 1 } });

    renderSuppliers();

    const row = await screen.findByRole('row', { name: new RegExp(sup01.code) });
    expect(row.textContent).toContain('-');
  });

  it('shows a Thai empty-state message rather than a blank panel when there are no suppliers', async () => {
    mockApi({ 'GET /suppliers': { items: [], total: 0 } });

    renderSuppliers();

    expect(await screen.findByText(/ไม่พบซัพพลายเออร์/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("shows the API's Thai message when the list request failed", async () => {
    mockApi({ 'GET /suppliers': serverError() });

    renderSuppliers();

    expect(await screen.findByRole('alert', undefined, { timeout: 4000 })).toHaveTextContent(
      APP_ERRORS.UNEXPECTED.message,
    );
  });

  it('reads the page from the query string, so a list view is shareable', async () => {
    const fetch = mockApi({ 'GET /suppliers': { items: [sup01], total: 21 } });

    renderSuppliers('/suppliers?page=2&pageSize=1');

    await screen.findByText('SUP01');
    const url = new URL(fetch.mock.calls[0]![0].url);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('1');
  });

  it('says how many suppliers matched, so the count the API returns is visible', async () => {
    mockApi({ 'GET /suppliers': { items: [sup01, sup02], total: 2 } });

    renderSuppliers();

    expect(await screen.findByText(/ทั้งหมด 2 ซัพพลายเออร์/)).toBeInTheDocument();
  });
});
