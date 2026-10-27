import { oc } from '@orpc/contract';
import * as z from 'zod';
import { routeError } from './errors.js';

/**
 * A supplier (MD-03). `code` is the business key people type and read on documents, unique
 * across the organisation like `Store.code`; `id` stays internal so a code can be corrected
 * without rewriting history.
 *
 * `phone` and `address` are the only contact details #6 scopes in, both optional and nullable.
 * Neither is format-validated: a Thai phone number has no single shape worth refusing a caller
 * over, and no feature reads either field yet. An email address and a named contact person are
 * out of scope; add them when a feature needs them.
 */
export const SupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

/** Blank is treated the same as omitted, so a cleared field reaches the API as `null`. */
const ContactFieldSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const SupplierCreateInputSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  phone: ContactFieldSchema,
  address: ContactFieldSchema,
});
export type SupplierCreateInput = z.infer<typeof SupplierCreateInputSchema>;

/** The code is editable, so the supplier is addressed by its internal id, never by its code. */
export const SupplierUpdateInputSchema = SupplierCreateInputSchema.extend({
  id: z.string().min(1),
});
export type SupplierUpdateInput = z.infer<typeof SupplierUpdateInputSchema>;

export const SUPPLIER_PAGE_SIZE_DEFAULT = 20;
export const SUPPLIER_PAGE_SIZE_MAX = 100;

export const SupplierListInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(SUPPLIER_PAGE_SIZE_MAX)
    .default(SUPPLIER_PAGE_SIZE_DEFAULT),
});
export type SupplierListInput = z.infer<typeof SupplierListInputSchema>;

/** One page of suppliers and the count of everything that matched, not just this page. */
export const SupplierListSchema = z.object({
  items: z.array(SupplierSchema),
  total: z.number().int().nonnegative(),
});
export type SupplierList = z.infer<typeof SupplierListSchema>;

export const suppliersContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/suppliers',
      summary: 'One page of suppliers, newest first, with the total count',
      tags: ['Suppliers'],
    })
    .input(SupplierListInputSchema)
    .output(SupplierListSchema),
  create: oc
    .route({
      method: 'POST',
      path: '/suppliers',
      summary: 'Create a supplier',
      tags: ['Suppliers'],
    })
    // Declared on the route so the Thai message is part of the published contract (NFR-04).
    .errors({ SUPPLIER_CODE_TAKEN: routeError('SUPPLIER_CODE_TAKEN', 409) })
    .input(SupplierCreateInputSchema)
    .output(SupplierSchema),
  update: oc
    .route({
      method: 'PATCH',
      path: '/suppliers/{id}',
      summary: "Edit a supplier's code, name and contact details",
      tags: ['Suppliers'],
    })
    .errors({
      SUPPLIER_CODE_TAKEN: routeError('SUPPLIER_CODE_TAKEN', 409),
      SUPPLIER_NOT_FOUND: routeError('SUPPLIER_NOT_FOUND', 404),
    })
    .input(SupplierUpdateInputSchema)
    .output(SupplierSchema),
};
