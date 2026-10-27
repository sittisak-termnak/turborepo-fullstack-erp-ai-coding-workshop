import { oc } from '@orpc/contract';
import * as z from 'zod';
import { routeError } from './errors.js';

/**
 * A RetailOne branch (MD-03). `code` is the business key people type and read on documents
 * (B01, B02); `id` stays internal so a code can be corrected without rewriting history.
 */
export const StoreSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type Store = z.infer<typeof StoreSchema>;

/** Read one store by its business code. The handler authorises the caller against it (NFR-01). */
export const StoreReadInputSchema = z.object({
  code: z.string().min(1),
});
export type StoreReadInput = z.infer<typeof StoreReadInputSchema>;

/**
 * Offset pagination, not cursor: the reports of §6.2 need a document count, and the volumes in
 * NFR-05 make the cost of counting negligible. #5 is the first list in the product, so these are
 * the primitives every later list reuses. The bounds live here, in the contract, so no caller
 * invents its own default and no request can ask for the whole table.
 */
export const STORE_PAGE_SIZE_DEFAULT = 20;
export const STORE_PAGE_SIZE_MAX = 100;

export const StoreListInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(STORE_PAGE_SIZE_MAX)
    .default(STORE_PAGE_SIZE_DEFAULT),
  /** Matches the code or the name. Trimmed, because a blank filter would match every row. */
  q: z.string().trim().min(1).optional(),
});
export type StoreListInput = z.infer<typeof StoreListInputSchema>;

/** One page of stores and the count of everything the filter matched, not just this page. */
export const StoreListSchema = z.object({
  items: z.array(StoreSchema),
  total: z.number().int().nonnegative(),
});
export type StoreList = z.infer<typeof StoreListSchema>;

export const StoreCreateInputSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
});
export type StoreCreateInput = z.infer<typeof StoreCreateInputSchema>;

/** The code is editable, so the store is addressed by its internal id, never by its code. */
export const StoreUpdateInputSchema = StoreCreateInputSchema.extend({
  id: z.string().min(1),
});
export type StoreUpdateInput = z.infer<typeof StoreUpdateInputSchema>;

export const storesContract = {
  read: oc
    .route({
      method: 'GET',
      path: '/stores/{code}',
      summary: 'Read one store by code, if the caller is allowed to see it',
      tags: ['Stores'],
    })
    .input(StoreReadInputSchema)
    .output(StoreSchema),
  list: oc
    .route({
      method: 'GET',
      path: '/stores',
      summary: 'One page of stores, newest first, with the total count',
      tags: ['Stores'],
    })
    .input(StoreListInputSchema)
    .output(StoreListSchema),
  create: oc
    .route({
      method: 'POST',
      path: '/stores',
      summary: 'Create a store',
      tags: ['Stores'],
    })
    // Declared on the route so the Thai message is part of the published contract (NFR-04).
    .errors({ STORE_CODE_TAKEN: routeError('STORE_CODE_TAKEN', 409) })
    .input(StoreCreateInputSchema)
    .output(StoreSchema),
  update: oc
    .route({
      method: 'PATCH',
      path: '/stores/{id}',
      summary: "Edit a store's code and name",
      tags: ['Stores'],
    })
    .errors({
      STORE_CODE_TAKEN: routeError('STORE_CODE_TAKEN', 409),
      STORE_NOT_FOUND: routeError('STORE_NOT_FOUND', 404),
    })
    .input(StoreUpdateInputSchema)
    .output(StoreSchema),
};
