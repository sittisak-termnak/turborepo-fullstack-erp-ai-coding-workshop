import { describe, expect, it } from 'vitest';
import {
  STORE_PAGE_SIZE_DEFAULT,
  STORE_PAGE_SIZE_MAX,
  StoreCreateInputSchema,
  StoreListInputSchema,
  StoreListSchema,
  StoreReadInputSchema,
  StoreSchema,
  StoreUpdateInputSchema,
} from './stores.js';

describe('StoreSchema', () => {
  it('accepts a store with a code and a name', () => {
    const result = StoreSchema.safeParse({ id: 'store-b01', code: 'B01', name: 'Branch 01' });

    expect(result.success).toBe(true);
  });

  it('rejects a store missing its code', () => {
    const result = StoreSchema.safeParse({ id: 'store-b01', name: 'Branch 01' });

    expect(result.success).toBe(false);
  });
});

describe('StoreReadInputSchema', () => {
  it('accepts a non-empty code', () => {
    expect(StoreReadInputSchema.safeParse({ code: 'B02' }).success).toBe(true);
  });

  it('rejects an empty code', () => {
    expect(StoreReadInputSchema.safeParse({ code: '' }).success).toBe(false);
  });
});

describe('StoreListInputSchema', () => {
  // #5 lands the pagination primitives every later list reuses, so the defaults live in the
  // contract rather than in each caller.
  it('defaults to the first page when the caller sends nothing', () => {
    const result = StoreListInputSchema.safeParse({});

    expect(result.data).toEqual({ page: 1, pageSize: STORE_PAGE_SIZE_DEFAULT });
  });

  it('coerces the query string a GET request actually delivers', () => {
    const result = StoreListInputSchema.safeParse({ page: '3', pageSize: '10' });

    expect(result.data).toMatchObject({ page: 3, pageSize: 10 });
  });

  it('rejects a page below the first one', () => {
    expect(StoreListInputSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects a pageSize above the maximum, so one request cannot ask for the whole table', () => {
    expect(StoreListInputSchema.safeParse({ pageSize: STORE_PAGE_SIZE_MAX + 1 }).success).toBe(
      false,
    );
  });

  it('accepts a filter and trims it', () => {
    expect(StoreListInputSchema.safeParse({ q: '  B01 ' }).data?.q).toBe('B01');
  });

  it('rejects a filter that is only whitespace, which would match everything', () => {
    expect(StoreListInputSchema.safeParse({ q: '   ' }).success).toBe(false);
  });
});

describe('StoreListSchema', () => {
  it('carries one page of stores together with the total count', () => {
    const result = StoreListSchema.safeParse({
      items: [{ id: 'store-b01', code: 'B01', name: 'Branch 01' }],
      total: 7,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a page without the total, which is what the reports need', () => {
    const result = StoreListSchema.safeParse({
      items: [{ id: 'store-b01', code: 'B01', name: 'Branch 01' }],
    });

    expect(result.success).toBe(false);
  });

  it('accepts an empty page, which is the empty state the screen must render', () => {
    expect(StoreListSchema.safeParse({ items: [], total: 0 }).success).toBe(true);
  });
});

describe('StoreCreateInputSchema', () => {
  it('accepts a code and a name', () => {
    expect(StoreCreateInputSchema.safeParse({ code: 'B03', name: 'Branch 03' }).success).toBe(true);
  });

  it('rejects a blank name', () => {
    expect(StoreCreateInputSchema.safeParse({ code: 'B03', name: ' ' }).success).toBe(false);
  });
});

describe('StoreUpdateInputSchema', () => {
  // The code is editable, so the store is addressed by its internal id. See stores.ts.
  it('addresses the store by id and carries the new code and name', () => {
    const result = StoreUpdateInputSchema.safeParse({
      id: 'store-b01',
      code: 'B01X',
      name: 'Branch 01',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an update without an id', () => {
    expect(StoreUpdateInputSchema.safeParse({ code: 'B01X', name: 'Branch 01' }).success).toBe(
      false,
    );
  });
});
