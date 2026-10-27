import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { StockPage } from './stock';

const staffB01 = {
  id: 'u1',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-b01',
};
const manager = {
  id: 'u2',
  email: 'manager01@erp.local',
  name: 'Manager One',
  role: 'MANAGER',
  storeId: null,
};

const lowStockItem = {
  productId: 'product-detergent',
  sku: 'SKU003',
  productName: 'Laundry detergent',
  unit: 'bag',
  storeId: 'store-b01',
  storeCode: 'B01',
  storeName: 'Branch 01',
  balance: 0,
  reorderThreshold: 3,
  lowStock: true,
};
const normalItem = {
  productId: 'product-tissue',
  sku: 'SKU002',
  productName: 'Tissue paper',
  unit: 'pack',
  storeId: 'store-b01',
  storeCode: 'B01',
  storeName: 'Branch 01',
  balance: 5,
  reorderThreshold: 3,
  lowStock: false,
};

function renderStockPage(
  user: typeof staffB01 | typeof manager,
  stockResponse: unknown = { items: [lowStockItem, normalItem], total: 2 },
) {
  const fetch = mockApi({ 'GET /auth/me': { user }, 'GET /stock': stockResponse });
  const router = createMemoryRouter([{ path: '/', element: <StockPage /> }], {
    initialEntries: ['/'],
  });
  const result = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, fetch };
}

describe('StockPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows each row with quantity, unit and reorder threshold', async () => {
    renderStockPage(staffB01);

    const row = await screen.findByRole('row', { name: /SKU003/ });
    expect(row).toHaveTextContent('Laundry detergent');
    expect(row).toHaveTextContent('bag');
    expect(row).toHaveTextContent('0');
    expect(row).toHaveTextContent('3');
  });

  // AC: "A low-stock indicator appears when quantity is at or below the threshold and not
  // otherwise."
  it('shows the low-stock indicator only on the row at or below its threshold', async () => {
    renderStockPage(staffB01);

    const lowRow = await screen.findByRole('row', { name: /SKU003/ });
    const normalRow = await screen.findByRole('row', { name: /SKU002/ });

    expect(lowRow).toHaveTextContent('สต็อกต่ำ');
    expect(normalRow).not.toHaveTextContent('สต็อกต่ำ');
  });

  // A Store employee's own store is enforced at the API (NFR-01); the screen does not even
  // offer a store filter, since there is only ever one store it would apply to.
  it('does not offer a store filter to a Store employee', async () => {
    renderStockPage(staffB01);
    await screen.findByRole('row', { name: /SKU003/ });

    expect(screen.queryByLabelText('ค้นหาตามสาขา')).not.toBeInTheDocument();
  });

  // A Manager's search spans every store, so the screen offers a way to narrow it to one.
  it('offers a store filter to a Manager', async () => {
    renderStockPage(manager);
    await screen.findByRole('row', { name: /SKU003/ });

    expect(screen.getByLabelText('ค้นหาตามสาขา')).toBeInTheDocument();
  });

  it('sends the SKU or product name filter typed into the search box', async () => {
    const { fetch } = renderStockPage(manager, { items: [], total: 0 });
    await screen.findByLabelText('ค้นหาสินค้า');

    fireEvent.change(screen.getByLabelText('ค้นหาสินค้า'), { target: { value: 'SKU003' } });
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));

    const call = await vi.waitFor(() => {
      const found = fetch.mock.calls.find(
        ([request]) => new URL(request.url).searchParams.get('q') === 'SKU003',
      );
      if (!found) throw new Error('no request carried q=SKU003 yet');
      return found;
    });
    expect(call).toBeDefined();
  });

  it('shows the empty-state message when nothing matches', async () => {
    renderStockPage(manager, { items: [], total: 0 });

    expect(await screen.findByText('ไม่พบสินค้าที่ตรงกับเงื่อนไข')).toBeInTheDocument();
  });
});
