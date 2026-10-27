import { oc } from '@orpc/contract';
import * as z from 'zod';
import { routeError } from './errors.js';

/**
 * A catalogue item (MD-01). `sku` is the business key; `id` stays internal. The reorder
 * threshold and stock balance are not here: MD-01 makes them per store, so they live on
 * ProductStore instead (see product-stores.ts).
 */
export const ProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  sellingPrice: z.number(),
  active: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductCreateInputSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  // MD-02: a negative selling price is refused.
  sellingPrice: z.coerce.number().nonnegative(),
  active: z.boolean().default(true),
});
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

/** The sku is editable, so the product is addressed by its internal id, never by its sku. */
export const ProductUpdateInputSchema = ProductCreateInputSchema.extend({
  id: z.string().min(1),
});
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;

export const PRODUCT_PAGE_SIZE_DEFAULT = 20;
export const PRODUCT_PAGE_SIZE_MAX = 100;

export const ProductListInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRODUCT_PAGE_SIZE_MAX)
    .default(PRODUCT_PAGE_SIZE_DEFAULT),
  /** Matches the SKU, name or category. Trimmed, because a blank filter would match every row. */
  q: z.string().trim().min(1).optional(),
  /**
   * MD-02's two faces of one rule, both answered by this one endpoint: omitted, every product
   * comes back, which is the admin's own historical search. `true` returns active products
   * only, which is what a new document's product picker asks for, so a deactivated product
   * disappears from it without a separate "document" concept existing yet.
   */
  active: z.coerce.boolean().optional(),
});
export type ProductListInput = z.infer<typeof ProductListInputSchema>;

/** One page of products and the count of everything the filter matched, not just this page. */
export const ProductListSchema = z.object({
  items: z.array(ProductSchema),
  total: z.number().int().nonnegative(),
});
export type ProductList = z.infer<typeof ProductListSchema>;

export const productsContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/products',
      summary: 'One page of products, newest first, with the total count',
      tags: ['Products'],
    })
    .input(ProductListInputSchema)
    .output(ProductListSchema),
  create: oc
    .route({
      method: 'POST',
      path: '/products',
      summary: 'Create a product, with a product-store record for every existing store',
      tags: ['Products'],
    })
    // Declared on the route so the Thai message is part of the published contract (NFR-04).
    .errors({ PRODUCT_SKU_TAKEN: routeError('PRODUCT_SKU_TAKEN', 409) })
    .input(ProductCreateInputSchema)
    .output(ProductSchema),
  update: oc
    .route({
      method: 'PATCH',
      path: '/products/{id}',
      summary: "Edit a product's fields, including its active status",
      tags: ['Products'],
    })
    .errors({
      PRODUCT_SKU_TAKEN: routeError('PRODUCT_SKU_TAKEN', 409),
      PRODUCT_NOT_FOUND: routeError('PRODUCT_NOT_FOUND', 404),
    })
    .input(ProductUpdateInputSchema)
    .output(ProductSchema),
};
