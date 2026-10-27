import { oc } from '@orpc/contract';
import * as z from 'zod';

/**
 * One product's stock at one store, as INV-01's search answers it: the balance and reorder
 * threshold already published by ProductStoreSchema, joined with the product's own SKU, name
 * and unit so the row stands on its own. `lowStock` is computed here rather than left for a
 * screen to recompute, so "at or below the threshold" has exactly one definition.
 */
export const StockItemSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  unit: z.string(),
  storeId: z.string(),
  storeCode: z.string(),
  storeName: z.string(),
  balance: z.number().int(),
  reorderThreshold: z.number().int().nonnegative(),
  /** INV-01: quantity at or below the threshold. */
  lowStock: z.boolean(),
});
export type StockItem = z.infer<typeof StockItemSchema>;

export const STOCK_PAGE_SIZE_DEFAULT = 20;
export const STOCK_PAGE_SIZE_MAX = 100;

export const StockListInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(STOCK_PAGE_SIZE_MAX)
    .default(STOCK_PAGE_SIZE_DEFAULT),
  /** Matches the SKU or the product name. Trimmed, because a blank filter would match every row. */
  q: z.string().trim().min(1).optional(),
  /**
   * Matches the store code or name. A Store employee's own store always applies on top of this,
   * enforced in the handler (NFR-01): the field exists for the cross-store roles INV-01 lets
   * narrow a search to one store, not as a way around that scoping.
   */
  store: z.string().trim().min(1).optional(),
});
export type StockListInput = z.infer<typeof StockListInputSchema>;

/** One page of stock rows and the count of everything the filter matched, not just this page. */
export const StockListSchema = z.object({
  items: z.array(StockItemSchema),
  total: z.number().int().nonnegative(),
});
export type StockList = z.infer<typeof StockListSchema>;

export const stockContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/stock',
      summary:
        "One page of stock balances, newest first, scoped to a Store employee's own store (INV-01)",
      tags: ['Stock'],
    })
    .input(StockListInputSchema)
    .output(StockListSchema),
};
