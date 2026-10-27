import { describe, expect, it } from 'vitest';
import { DEMO_PRODUCTS, DEMO_REORDER_THRESHOLD } from './demo-products.js';

/** Expected values come from TOR section 8.1. */
describe('DEMO_PRODUCTS', () => {
  it('seeds the three §8.1 SKUs with their stated prices', () => {
    expect(DEMO_PRODUCTS.map((p) => [p.sku, p.sellingPrice])).toEqual([
      ['SKU001', 60],
      ['SKU002', 35],
      ['SKU003', 120],
    ]);
  });

  it('seeds the stated B01 opening balances, including the zero-stock SKU003', () => {
    expect(DEMO_PRODUCTS.map((p) => [p.sku, p.b01Balance])).toEqual([
      ['SKU001', 10],
      ['SKU002', 5],
      ['SKU003', 0],
    ]);
  });

  it('gives every product a distinct SKU', () => {
    const skus = DEMO_PRODUCTS.map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('uses a reorder threshold of 3 for every product at every store', () => {
    expect(DEMO_REORDER_THRESHOLD).toBe(3);
  });
});
