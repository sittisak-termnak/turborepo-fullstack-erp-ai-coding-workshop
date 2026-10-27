/**
 * The three §8.1 products and their starting data (MD-01, MD-02). Every product gets a
 * reorder threshold of 3 at both stores; B01 holds the stated opening balance, B02 is zero
 * everywhere, exactly as section 8.1 states it.
 */
export const DEMO_PRODUCTS = [
  {
    sku: 'SKU001',
    name: 'Drinking water pack of 6',
    category: 'Beverages',
    unit: 'pack',
    sellingPrice: 60.0,
    b01Balance: 10,
  },
  {
    sku: 'SKU002',
    name: 'Tissue paper',
    category: 'Household',
    unit: 'pack',
    sellingPrice: 35.0,
    b01Balance: 5,
  },
  {
    sku: 'SKU003',
    name: 'Laundry detergent',
    category: 'Cleaning',
    unit: 'bag',
    sellingPrice: 120.0,
    b01Balance: 0,
  },
] as const;

/** Section 8.1: "Every product has a reorder threshold of 3." */
export const DEMO_REORDER_THRESHOLD = 3;
