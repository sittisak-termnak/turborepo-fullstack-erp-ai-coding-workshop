import { describe, expect, it } from 'vitest';
import { StoreReadInputSchema, StoreSchema } from './stores.js';

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
