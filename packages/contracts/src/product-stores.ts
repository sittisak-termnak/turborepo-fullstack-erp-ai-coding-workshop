import { oc } from '@orpc/contract';
import * as z from 'zod';
import { routeError } from './errors.js';

/**
 * One product's balance and reorder threshold at one store (MD-01). Created eagerly -- for
 * every store when a product is created, and for every product when a store is created -- so
 * every row named here always exists; there is no "create" route in this contract, only read
 * and the threshold edit.
 */
export const ProductStoreSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  storeCode: z.string(),
  storeName: z.string(),
  balance: z.number().int(),
  reorderThreshold: z.number().int().nonnegative(),
});
export type ProductStore = z.infer<typeof ProductStoreSchema>;

export const ProductStoreListInputSchema = z.object({
  productId: z.string().min(1),
});
export type ProductStoreListInput = z.infer<typeof ProductStoreListInputSchema>;

export const ProductStoreUpdateInputSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  // MD-02: "reorder thresholds cannot be negative" and "stock quantities must be whole numbers".
  reorderThreshold: z.coerce.number().int().nonnegative(),
});
export type ProductStoreUpdateInput = z.infer<typeof ProductStoreUpdateInputSchema>;

export const productStoresContract = {
  listForProduct: oc
    .route({
      method: 'GET',
      path: '/products/{productId}/stores',
      summary: 'Every store, with this product\u2019s balance and reorder threshold at each',
      tags: ['Products'],
    })
    .input(ProductStoreListInputSchema)
    .output(z.array(ProductStoreSchema)),
  updateThreshold: oc
    .route({
      method: 'PATCH',
      path: '/products/{productId}/stores/{storeId}',
      summary: 'Set the reorder threshold for one product at one store',
      tags: ['Products'],
    })
    .errors({ PRODUCT_STORE_NOT_FOUND: routeError('PRODUCT_STORE_NOT_FOUND', 404) })
    .input(ProductStoreUpdateInputSchema)
    .output(ProductStoreSchema),
};
