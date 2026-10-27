import { describe, expect, it } from 'vitest';
import {
  STOCK_PAGE_SIZE_DEFAULT,
  STOCK_PAGE_SIZE_MAX,
  StockItemSchema,
  StockListInputSchema,
  StockListSchema,
} from './stock.js';

const validItem = {
  productId: 'product-1',
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

describe('StockItemSchema', () => {
  it('accepts a stock row carrying every INV-01 field', () => {
    expect(StockItemSchema.safeParse(validItem).success).toBe(true);
  });

  it('rejects a row missing its low-stock indicator', () => {
    const { lowStock: _lowStock, ...rest } = validItem;
    expect(StockItemSchema.safeParse(rest).success).toBe(false);
  });
});

describe('StockListInputSchema', () => {
  it('defaults to the first page when the caller sends nothing', () => {
    const result = StockListInputSchema.safeParse({});
    expect(result.data).toEqual({ page: 1, pageSize: STOCK_PAGE_SIZE_DEFAULT });
  });

  it('coerces the query string a GET request actually delivers', () => {
    const result = StockListInputSchema.safeParse({ page: '2', pageSize: '10' });
    expect(result.data).toMatchObject({ page: 2, pageSize: 10 });
  });

  it('rejects a pageSize above the maximum', () => {
    expect(StockListInputSchema.safeParse({ pageSize: STOCK_PAGE_SIZE_MAX + 1 }).success).toBe(
      false,
    );
  });

  it('accepts a filter on SKU or product name and trims it', () => {
    expect(StockListInputSchema.safeParse({ q: ' SKU003 ' }).data?.q).toBe('SKU003');
  });

  it('accepts a filter on the store code or name and trims it', () => {
    expect(StockListInputSchema.safeParse({ store: ' B01 ' }).data?.store).toBe('B01');
  });
});

describe('StockListSchema', () => {
  it('carries one page of stock rows together with the total count', () => {
    expect(StockListSchema.safeParse({ items: [validItem], total: 1 }).success).toBe(true);
  });

  it('accepts an empty page', () => {
    expect(StockListSchema.safeParse({ items: [], total: 0 }).success).toBe(true);
  });
});
