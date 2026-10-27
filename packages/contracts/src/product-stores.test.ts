import { describe, expect, it } from 'vitest';
import {
  ProductStoreListInputSchema,
  ProductStoreSchema,
  ProductStoreUpdateInputSchema,
} from './product-stores.js';

const validRow = {
  productId: 'product-1',
  storeId: 'store-b01',
  storeCode: 'B01',
  storeName: 'Branch 01',
  balance: 10,
  reorderThreshold: 3,
};

describe('ProductStoreSchema', () => {
  it('accepts a per-store balance and reorder threshold', () => {
    expect(ProductStoreSchema.safeParse(validRow).success).toBe(true);
  });
});

describe('ProductStoreListInputSchema', () => {
  it('requires the product id', () => {
    expect(ProductStoreListInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a product id', () => {
    expect(ProductStoreListInputSchema.safeParse({ productId: 'product-1' }).success).toBe(true);
  });
});

describe('ProductStoreUpdateInputSchema', () => {
  it('accepts a whole-number, non-negative threshold', () => {
    const result = ProductStoreUpdateInputSchema.safeParse({
      productId: 'product-1',
      storeId: 'store-b01',
      reorderThreshold: 5,
    });
    expect(result.success).toBe(true);
  });

  // MD-02: "Stock quantities must be whole numbers."
  it('rejects a fractional threshold', () => {
    const result = ProductStoreUpdateInputSchema.safeParse({
      productId: 'product-1',
      storeId: 'store-b01',
      reorderThreshold: 1.5,
    });
    expect(result.success).toBe(false);
  });

  // MD-02: "reorder thresholds cannot be negative."
  it('rejects a negative threshold', () => {
    const result = ProductStoreUpdateInputSchema.safeParse({
      productId: 'product-1',
      storeId: 'store-b01',
      reorderThreshold: -1,
    });
    expect(result.success).toBe(false);
  });

  it('coerces a threshold delivered as a form-string number', () => {
    const result = ProductStoreUpdateInputSchema.safeParse({
      productId: 'product-1',
      storeId: 'store-b01',
      reorderThreshold: '5',
    });
    expect(result.data?.reorderThreshold).toBe(5);
  });
});
