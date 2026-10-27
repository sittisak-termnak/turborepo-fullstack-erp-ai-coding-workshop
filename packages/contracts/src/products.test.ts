import { describe, expect, it } from 'vitest';
import {
  PRODUCT_PAGE_SIZE_DEFAULT,
  PRODUCT_PAGE_SIZE_MAX,
  ProductCreateInputSchema,
  ProductListInputSchema,
  ProductListSchema,
  ProductSchema,
  ProductUpdateInputSchema,
} from './products.js';

const validProduct = {
  id: 'product-1',
  sku: 'SKU001',
  name: 'Drinking water pack of 6',
  category: 'Beverages',
  unit: 'pack',
  sellingPrice: 60,
  active: true,
};

describe('ProductSchema', () => {
  it('accepts a product with every field MD-01 requires', () => {
    expect(ProductSchema.safeParse(validProduct).success).toBe(true);
  });

  it('rejects a product missing its SKU', () => {
    const { sku, ...rest } = validProduct;
    expect(ProductSchema.safeParse(rest).success).toBe(false);
  });
});

describe('ProductCreateInputSchema', () => {
  it('accepts a product with every MD-01 field and defaults active to true', () => {
    const { id, active, ...input } = validProduct;
    const result = ProductCreateInputSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.active).toBe(true);
  });

  it('rejects a blank SKU', () => {
    const { id, ...input } = validProduct;
    expect(ProductCreateInputSchema.safeParse({ ...input, sku: ' ' }).success).toBe(false);
  });

  // MD-02.
  it('rejects a negative selling price', () => {
    const { id, ...input } = validProduct;
    expect(ProductCreateInputSchema.safeParse({ ...input, sellingPrice: -1 }).success).toBe(
      false,
    );
  });

  it('accepts a selling price of zero', () => {
    const { id, ...input } = validProduct;
    expect(ProductCreateInputSchema.safeParse({ ...input, sellingPrice: 0 }).success).toBe(true);
  });

  it('coerces a selling price delivered as a query-string number', () => {
    const { id, ...input } = validProduct;
    const result = ProductCreateInputSchema.safeParse({ ...input, sellingPrice: '60' });
    expect(result.data?.sellingPrice).toBe(60);
  });
});

describe('ProductUpdateInputSchema', () => {
  it('addresses the product by id and carries every MD-01 field', () => {
    const result = ProductUpdateInputSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it('rejects an update without an id', () => {
    const { id, ...input } = validProduct;
    expect(ProductUpdateInputSchema.safeParse(input).success).toBe(false);
  });

  it('carries the active flag, so deactivation is an ordinary edit', () => {
    const result = ProductUpdateInputSchema.safeParse({ ...validProduct, active: false });
    expect(result.data?.active).toBe(false);
  });
});

describe('ProductListInputSchema', () => {
  it('defaults to the first page when the caller sends nothing', () => {
    const result = ProductListInputSchema.safeParse({});
    expect(result.data).toEqual({ page: 1, pageSize: PRODUCT_PAGE_SIZE_DEFAULT });
  });

  it('coerces the query string a GET request actually delivers', () => {
    const result = ProductListInputSchema.safeParse({ page: '2', pageSize: '10' });
    expect(result.data).toMatchObject({ page: 2, pageSize: 10 });
  });

  it('rejects a pageSize above the maximum', () => {
    expect(ProductListInputSchema.safeParse({ pageSize: PRODUCT_PAGE_SIZE_MAX + 1 }).success).toBe(
      false,
    );
  });

  it('accepts a filter and trims it', () => {
    expect(ProductListInputSchema.safeParse({ q: ' SKU001 ' }).data?.q).toBe('SKU001');
  });

  // MD-02: a deactivated product must remain findable, so omitting the filter is the admin's
  // own search and must not default to active-only.
  it('leaves the active filter unset when the caller sends nothing, so search finds every status', () => {
    expect(ProductListInputSchema.safeParse({}).data?.active).toBeUndefined();
  });

  it('coerces an explicit active-only filter, what a new document would ask for', () => {
    expect(ProductListInputSchema.safeParse({ active: 'true' }).data?.active).toBe(true);
  });
});

describe('ProductListSchema', () => {
  it('carries one page of products together with the total count', () => {
    const result = ProductListSchema.safeParse({ items: [validProduct], total: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts an empty page', () => {
    expect(ProductListSchema.safeParse({ items: [], total: 0 }).success).toBe(true);
  });
});
