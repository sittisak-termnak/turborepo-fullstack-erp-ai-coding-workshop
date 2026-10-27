import { describe, expect, it } from 'vitest';
import { DEMO_SUPPLIERS } from './demo-suppliers.js';

/** Expected values come from TOR section 8.1. */
describe('DEMO_SUPPLIERS', () => {
  it('seeds the §8.1 supplier SUP01 / SupplyOne Co Ltd', () => {
    expect(DEMO_SUPPLIERS).toEqual([
      { code: 'SUP01', name: 'SupplyOne Co Ltd', phone: null, address: null },
    ]);
  });

  it('leaves phone and address null, since §8.1 gives no contact values', () => {
    for (const supplier of DEMO_SUPPLIERS) {
      expect(supplier.phone).toBeNull();
      expect(supplier.address).toBeNull();
    }
  });
});
