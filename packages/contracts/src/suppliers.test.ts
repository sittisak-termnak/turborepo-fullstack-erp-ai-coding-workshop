import { describe, expect, it } from 'vitest';
import {
  SUPPLIER_PAGE_SIZE_DEFAULT,
  SUPPLIER_PAGE_SIZE_MAX,
  SupplierCreateInputSchema,
  SupplierListInputSchema,
  SupplierListSchema,
  SupplierSchema,
  SupplierUpdateInputSchema,
} from './suppliers.js';

describe('SupplierSchema', () => {
  it('accepts a supplier with contact details', () => {
    const result = SupplierSchema.safeParse({
      id: 'supplier-sup01',
      code: 'SUP01',
      name: 'SupplyOne Co Ltd',
      phone: '02-111-2222',
      address: '1 ถนนสุขุมวิท',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a supplier with no contact details, the §8.1 seed shape', () => {
    const result = SupplierSchema.safeParse({
      id: 'supplier-sup01',
      code: 'SUP01',
      name: 'SupplyOne Co Ltd',
      phone: null,
      address: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a supplier missing its code', () => {
    const result = SupplierSchema.safeParse({
      id: 'supplier-sup01',
      name: 'SupplyOne Co Ltd',
      phone: null,
      address: null,
    });

    expect(result.success).toBe(false);
  });
});

describe('SupplierCreateInputSchema', () => {
  it('accepts a code and a name with no contact details', () => {
    const result = SupplierCreateInputSchema.safeParse({ code: 'SUP02', name: 'Supplier Two' });

    expect(result).toMatchObject({
      success: true,
      data: { code: 'SUP02', name: 'Supplier Two', phone: null, address: null },
    });
  });

  it('accepts and trims a phone and an address', () => {
    const result = SupplierCreateInputSchema.safeParse({
      code: 'SUP02',
      name: 'Supplier Two',
      phone: ' 02-111-2222 ',
      address: ' 1 ถนนสุขุมวิท ',
    });

    expect(result.data).toMatchObject({ phone: '02-111-2222', address: '1 ถนนสุขุมวิท' });
  });

  it('treats a blank phone the same as an omitted one', () => {
    const result = SupplierCreateInputSchema.safeParse({
      code: 'SUP02',
      name: 'Supplier Two',
      phone: '   ',
    });

    expect(result.data?.phone).toBeNull();
  });

  it('rejects a blank name', () => {
    expect(SupplierCreateInputSchema.safeParse({ code: 'SUP02', name: ' ' }).success).toBe(false);
  });
});

describe('SupplierUpdateInputSchema', () => {
  it('addresses the supplier by id and carries the new code, name and contact details', () => {
    const result = SupplierUpdateInputSchema.safeParse({
      id: 'supplier-sup01',
      code: 'SUP01X',
      name: 'SupplyOne Co Ltd',
      phone: '02-111-2222',
      address: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an update without an id', () => {
    expect(
      SupplierUpdateInputSchema.safeParse({ code: 'SUP01X', name: 'SupplyOne Co Ltd' }).success,
    ).toBe(false);
  });
});

describe('SupplierListInputSchema', () => {
  it('defaults to the first page when the caller sends nothing', () => {
    const result = SupplierListInputSchema.safeParse({});

    expect(result.data).toEqual({ page: 1, pageSize: SUPPLIER_PAGE_SIZE_DEFAULT });
  });

  it('coerces the query string a GET request actually delivers', () => {
    const result = SupplierListInputSchema.safeParse({ page: '2', pageSize: '10' });

    expect(result.data).toMatchObject({ page: 2, pageSize: 10 });
  });

  it('rejects a pageSize above the maximum, so one request cannot ask for the whole table', () => {
    expect(
      SupplierListInputSchema.safeParse({ pageSize: SUPPLIER_PAGE_SIZE_MAX + 1 }).success,
    ).toBe(false);
  });
});

describe('SupplierListSchema', () => {
  it('carries one page of suppliers together with the total count', () => {
    const result = SupplierListSchema.safeParse({
      items: [
        {
          id: 'supplier-sup01',
          code: 'SUP01',
          name: 'SupplyOne Co Ltd',
          phone: null,
          address: null,
        },
      ],
      total: 1,
    });

    expect(result.success).toBe(true);
  });

  it('accepts an empty page, which is the empty state the screen must render', () => {
    expect(SupplierListSchema.safeParse({ items: [], total: 0 }).success).toBe(true);
  });
});
