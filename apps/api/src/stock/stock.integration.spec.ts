import { ConfigService } from '@nestjs/config';
import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { StockController } from './stock.controller.js';

// DB-backed, mirroring products.integration.spec.ts: the rule under test -- a zero-balance
// product-store row still surfaces in a search, which only exists because of the real eager
// rows #7's tables hold -- depends on real rows a stub would only be asserting against itself.
// Skipped when DATABASE_URL is unset (the unit-only `check` job); the authoritative CI gate for
// the Demo line is stock.e2e.ts in the `e2e` job.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    '[stock.integration.spec] DATABASE_URL unset: skipping the DB-backed proofs. ' +
      'The authoritative gate is stock.e2e.ts in the e2e job.',
  );
}

const manager: User = {
  id: 'u-mgr',
  email: 'manager01@erp.local',
  name: 'Manager One',
  role: 'MANAGER',
  storeId: null,
};

describe.skipIf(!databaseUrl)('zero-balance visibility (integration)', () => {
  const prefix = 'TEST-STOCK-';
  const sku = `${prefix}ZERO`;
  let prisma: PrismaService;
  let stock: StockController;

  const cleanup = async () => {
    await prisma.productStore.deleteMany({ where: { product: { sku: { startsWith: prefix } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: prefix } } });
  };

  beforeAll(async () => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
    stock = new StockController(prisma);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // AC: "A product with zero stock appears in results whenever it matches the filter."
  it('includes a freshly created, never-moved product-store row in a matching search', async () => {
    const product = await prisma.product.create({
      data: {
        sku,
        name: 'Integration zero-stock product',
        category: 'Test',
        unit: 'pack',
        sellingPrice: 1,
      },
    });
    const [store] = await prisma.store.findMany();
    if (!store) throw new Error('expected at least one seeded store');
    // Written directly rather than through ProductsController.create, so this row carries the
    // same default balance and threshold of zero the eager-creation rule would have given it,
    // without depending on that rule's own test to prove it.
    await prisma.productStore.create({ data: { productId: product.id, storeId: store.id } });

    const page = await call(stock.list(manager), { page: 1, pageSize: 20, q: sku });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ sku, balance: 0, reorderThreshold: 0, lowStock: true });
  });
});

// Section 8.1's starting data. Assumes the seed has already run against this database, the same
// convention products.integration.spec.ts uses for the seeded catalogue.
describe.skipIf(!databaseUrl)('seed data (integration)', () => {
  let prisma: PrismaService;
  let stock: StockController;

  beforeAll(() => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
    stock = new StockController(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('shows SKU003 at B01 as zero balance and low stock, matching section 8.1', async () => {
    const page = await call(stock.list(manager), {
      page: 1,
      pageSize: 20,
      q: 'SKU003',
      store: 'B01',
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      sku: 'SKU003',
      storeCode: 'B01',
      balance: 0,
      reorderThreshold: 3,
      lowStock: true,
    });
  });

  it('shows SKU002 at B01 as above threshold and not low stock', async () => {
    const page = await call(stock.list(manager), {
      page: 1,
      pageSize: 20,
      q: 'SKU002',
      store: 'B01',
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ balance: 5, reorderThreshold: 3, lowStock: false });
  });
});
