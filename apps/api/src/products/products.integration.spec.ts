import { ConfigService } from '@nestjs/config';
import { call } from '@orpc/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { StoresController } from '../stores/stores.controller.js';
import { ProductStoresController } from './product-stores.controller.js';
import { ProductsController } from './products.controller.js';

// DB-backed, mirroring stores.integration.spec.ts: the rules under test (uniqueness, the eager
// product-store rows created both ways, independent per-store thresholds, and the seeded §8.1
// data) all depend on the real unique constraint and the real rows a stub would only be
// asserting against itself. Skipped when DATABASE_URL is unset (the unit-only `check` job);
// the authoritative CI gate for the Demo line is products.e2e.ts in the `e2e` job.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    '[products.integration.spec] DATABASE_URL unset: skipping the DB-backed proofs. ' +
      'The authoritative gate is products.e2e.ts in the e2e job.',
  );
}

describe.skipIf(!databaseUrl)('product SKU uniqueness (integration)', () => {
  // Prefixed so cleanup can never touch a seeded product.
  const prefix = 'TEST-UNIQ-';
  const sku = `${prefix}A`;
  let prisma: PrismaService;
  let products: ProductsController;

  const removeTestProducts = async () => {
    await prisma.productStore.deleteMany({ where: { product: { sku: { startsWith: prefix } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: prefix } } });
  };

  beforeAll(async () => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
    products = new ProductsController(prisma);
    await removeTestProducts();
  });

  afterAll(async () => {
    await removeTestProducts();
    await prisma.$disconnect();
  });

  it('refuses a second product claiming a SKU that is already taken, across the organisation', async () => {
    await expect(
      call(products.create(), {
        sku,
        name: 'Test product',
        category: 'Test',
        unit: 'pack',
        sellingPrice: 10,
        active: true,
      }),
    ).resolves.toMatchObject({ sku });

    await expect(
      call(products.create(), {
        sku,
        name: 'Duplicate product',
        category: 'Test',
        unit: 'pack',
        sellingPrice: 20,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_SKU_TAKEN' });
  });
});

describe.skipIf(!databaseUrl)('eager product-store creation (integration)', () => {
  const prefix = 'TEST-EAGER-';
  let prisma: PrismaService;
  let products: ProductsController;
  let productStores: ProductStoresController;
  let stores: StoresController;

  const cleanup = async () => {
    // A test store's eager rows reach every product, and a test product's reach every store,
    // so either prefix on either side of the join must be swept before the parents can go.
    await prisma.productStore.deleteMany({
      where: {
        OR: [
          { product: { sku: { startsWith: prefix } } },
          { store: { code: { startsWith: prefix } } },
        ],
      },
    });
    await prisma.product.deleteMany({ where: { sku: { startsWith: prefix } } });
    await prisma.store.deleteMany({ where: { code: { startsWith: prefix } } });
  };

  beforeAll(async () => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
    products = new ProductsController(prisma);
    productStores = new ProductStoresController(prisma);
    stores = new StoresController(prisma);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('creates a product-store record for every existing store when a product is created', async () => {
    const existingStores = await prisma.store.findMany({ select: { code: true } });

    const product = await call(products.create(), {
      sku: `${prefix}PRODUCT`,
      name: 'Eager creation product',
      category: 'Test',
      unit: 'pack',
      sellingPrice: 1,
      active: true,
    });

    const rows = await call(productStores.listForProduct(), { productId: product.id });
    expect(rows.map((row) => row.storeCode).sort()).toEqual(
      existingStores.map((store) => store.code).sort(),
    );
    // A product that has never moved still has a row, not an absence: INV-01/RPT-02 need the
    // zero-stock case visible, not reconstructed later.
    for (const row of rows) {
      expect(row.balance).toBe(0);
      expect(row.reorderThreshold).toBe(0);
    }
  });

  it('creates a product-store record for every existing product when a store is created', async () => {
    const existingProducts = await prisma.product.findMany({ select: { id: true } });

    const store = await call(stores.create(), { code: `${prefix}STORE`, name: 'Eager store' });

    const rows = await prisma.productStore.findMany({ where: { storeId: store.id } });
    expect(rows).toHaveLength(existingProducts.length);
    expect(new Set(rows.map((row) => row.productId))).toEqual(
      new Set(existingProducts.map((product) => product.id)),
    );
  });

  // The Demo line: give B01 and B02 different thresholds, each independent of the other.
  it('sets the reorder threshold independently for each store', async () => {
    const product = await call(products.create(), {
      sku: `${prefix}THRESHOLD`,
      name: 'Threshold product',
      category: 'Test',
      unit: 'pack',
      sellingPrice: 1,
      active: true,
    });
    const rows = await call(productStores.listForProduct(), { productId: product.id });
    const [b01, b02] = rows;
    if (!b01 || !b02) throw new Error('expected a row for every seeded store');

    await call(productStores.updateThreshold(), {
      productId: product.id,
      storeId: b01.storeId,
      reorderThreshold: 7,
    });

    const after = await call(productStores.listForProduct(), { productId: product.id });
    expect(after.find((row) => row.storeId === b01.storeId)?.reorderThreshold).toBe(7);
    expect(after.find((row) => row.storeId === b02.storeId)?.reorderThreshold).toBe(
      b02.reorderThreshold,
    );
  });
});

// Section 8.1's starting data, seeded by prisma/seed.ts from packages/database/src/demo-products.ts.
// Assumes the seed has already run against this database, same convention as
// stores.integration.spec.ts assuming the seeded users exist.
describe.skipIf(!databaseUrl)('seed data (integration)', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    ['SKU001', '60'],
    ['SKU002', '35'],
    ['SKU003', '120'],
  ])('seeds %s with its stated selling price', async (sku, price) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { sku } });
    expect(product.sellingPrice.toString()).toBe(price);
  });

  it.each([
    ['SKU001', 10],
    ['SKU002', 5],
    ['SKU003', 0],
  ])('seeds %s with its stated B01 balance', async (sku, balance) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { sku } });
    const b01 = await prisma.store.findUniqueOrThrow({ where: { code: 'B01' } });
    const row = await prisma.productStore.findUniqueOrThrow({
      where: { productId_storeId: { productId: product.id, storeId: b01.id } },
    });
    expect(row.balance).toBe(balance);
  });

  it.each(['SKU001', 'SKU002', 'SKU003'])('seeds %s with a zero balance at B02', async (sku) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { sku } });
    const b02 = await prisma.store.findUniqueOrThrow({ where: { code: 'B02' } });
    const row = await prisma.productStore.findUniqueOrThrow({
      where: { productId_storeId: { productId: product.id, storeId: b02.id } },
    });
    expect(row.balance).toBe(0);
  });

  // Checked at B01 and B02 by name, not by asserting the row count: a shared dev database also
  // carries whatever stores other tests created (#7's own eager creation reaches every store, on
  // purpose), and this proves the seeded threshold, not how many stores happen to exist.
  it.each(['SKU001', 'SKU002', 'SKU003'])(
    'seeds %s with a reorder threshold of 3 at both B01 and B02',
    async (sku) => {
      const product = await prisma.product.findUniqueOrThrow({ where: { sku } });
      for (const code of ['B01', 'B02']) {
        const store = await prisma.store.findUniqueOrThrow({ where: { code } });
        const row = await prisma.productStore.findUniqueOrThrow({
          where: { productId_storeId: { productId: product.id, storeId: store.id } },
        });
        expect(row.reorderThreshold).toBe(3);
      }
    },
  );
});
