import { auditContract } from './audit.js';
import { authContract } from './auth.js';
import { healthContract } from './health.js';
import { productStoresContract } from './product-stores.js';
import { productsContract } from './products.js';
import { stockContract } from './stock.js';
import { storesContract } from './stores.js';

export * from './audit.js';
export * from './auth.js';
export * from './errors.js';
export * from './health.js';
export * from './product-stores.js';
export * from './products.js';
export * from './stock.js';
export * from './stores.js';

/**
 * The single source of truth for the HTTP API.
 * - apps/api implements it (see `@Implement(...)` in the Nest controllers)
 * - apps/web calls it through a fully typed client (see `src/lib/orpc.ts`)
 *
 * Add new feature contracts here, e.g. `customers: customersContract`.
 */
export const contract = {
  audit: auditContract,
  auth: authContract,
  health: healthContract,
  products: productsContract,
  productStores: productStoresContract,
  stock: stockContract,
  stores: storesContract,
};

export type Contract = typeof contract;
