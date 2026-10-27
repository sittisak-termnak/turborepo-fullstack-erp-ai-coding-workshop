/**
 * The §8.1 supplier (MD-03): code `SUP01`, name `SupplyOne Co Ltd`. §8.1 gives no contact
 * values, and #6's own decision is not to invent placeholder ones, so `phone` and `address`
 * stay null, exactly as the seed row.
 */
export const DEMO_SUPPLIERS = [
  { code: 'SUP01', name: 'SupplyOne Co Ltd', phone: null, address: null },
] as const;
