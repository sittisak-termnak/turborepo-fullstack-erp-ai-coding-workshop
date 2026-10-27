import { oc } from '@orpc/contract';
import * as z from 'zod';

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
};
