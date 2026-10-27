import { Test } from '@nestjs/testing';
import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { StockController } from './stock.controller.js';

const staffB01: User = {
  id: 'u-staff-b01',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-b01',
};
const manager: User = {
  id: 'u-mgr',
  email: 'manager01@erp.local',
  name: 'Manager One',
  role: 'MANAGER',
  storeId: null,
};

type Row = {
  productId: string;
  storeId: string;
  balance: number;
  reorderThreshold: number;
  createdAt: Date;
  product: { sku: string; name: string; unit: string };
  store: { code: string; name: string };
};

const at = (iso: string) => new Date(iso);

const water = { sku: 'SKU001', name: 'Drinking water pack of 6', unit: 'pack' };
const tissue = { sku: 'SKU002', name: 'Tissue paper', unit: 'pack' };
const detergent = { sku: 'SKU003', name: 'Laundry detergent', unit: 'bag' };
const b01 = { code: 'B01', name: 'Branch 01' };
const b02 = { code: 'B02', name: 'Branch 02' };

const rowsNewestLast: Row[] = [
  {
    productId: 'product-water',
    storeId: 'store-b01',
    balance: 10,
    reorderThreshold: 3,
    createdAt: at('2026-01-01T00:00:00Z'),
    product: water,
    store: b01,
  },
  {
    productId: 'product-water',
    storeId: 'store-b02',
    balance: 0,
    reorderThreshold: 3,
    createdAt: at('2026-01-01T00:00:01Z'),
    product: water,
    store: b02,
  },
  {
    productId: 'product-tissue',
    storeId: 'store-b01',
    balance: 5,
    reorderThreshold: 3,
    createdAt: at('2026-02-01T00:00:00Z'),
    product: tissue,
    store: b01,
  },
  {
    productId: 'product-detergent',
    storeId: 'store-b01',
    balance: 0,
    reorderThreshold: 3,
    createdAt: at('2026-03-01T00:00:00Z'),
    product: detergent,
    store: b01,
  },
];

type Where = {
  storeId?: string;
  store?: { OR: { code?: { contains: string }; name?: { contains: string } }[] };
  product?: { OR: { sku?: { contains: string }; name?: { contains: string } }[] };
};

/**
 * A small fake of the join `productStore.findMany({ include: { product, store } })` would run,
 * applying `where`, `orderBy`, `skip` and `take` the same way the handler asks Prisma to: a test
 * asserts the rows and order that come back, not the arguments passed to Prisma.
 */
function stubPrisma(seed: Row[] = rowsNewestLast) {
  const rows = [...seed];

  const matchesText = (haystack: string, needle: string) =>
    haystack.toLowerCase().includes(needle.toLowerCase());

  const matches = (row: Row, where?: Where) => {
    if (where?.storeId !== undefined && row.storeId !== where.storeId) return false;
    if (
      where?.store &&
      !where.store.OR.some((clause) => {
        if (clause.code) return matchesText(row.store.code, clause.code.contains);
        if (clause.name) return matchesText(row.store.name, clause.name.contains);
        return true;
      })
    ) {
      return false;
    }
    if (
      where?.product &&
      !where.product.OR.some((clause) => {
        if (clause.sku) return matchesText(row.product.sku, clause.sku.contains);
        if (clause.name) return matchesText(row.product.name, clause.name.contains);
        return true;
      })
    ) {
      return false;
    }
    return true;
  };

  const storesById: Record<string, { id: string; code: string; name: string }> = {
    'store-b01': { id: 'store-b01', code: 'B01', name: 'Branch 01' },
    'store-b02': { id: 'store-b02', code: 'B02', name: 'Branch 02' },
  };

  return {
    store: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => storesById[where.id]),
    },
    auditLog: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
    productStore: {
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          skip = 0,
          take,
        }: {
          where?: Where;
          orderBy?: { createdAt?: 'asc' | 'desc' };
          skip?: number;
          take?: number;
        }) => {
          const found = rows.filter((row) => matches(row, where));
          const direction = orderBy?.createdAt === 'asc' ? 1 : -1;
          found.sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()));
          return found.slice(skip, take === undefined ? undefined : skip + take);
        },
      ),
      count: vi.fn(
        async ({ where }: { where?: Where } = {}) =>
          rows.filter((row) => matches(row, where)).length,
      ),
    },
  };
}

async function createController(prisma: ReturnType<typeof stubPrisma>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [StockController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(StockController);
}

describe('StockController.list', () => {
  it('orders the page newest first', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 1, pageSize: 20 });

    expect(page.items.map((item) => item.sku)).toEqual(['SKU003', 'SKU002', 'SKU001', 'SKU001']);
  });

  it('finds a match by SKU', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 1, pageSize: 20, q: 'sku002' });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ sku: 'SKU002', productName: 'Tissue paper' });
  });

  it('finds a match by product name', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), {
      page: 1,
      pageSize: 20,
      q: 'laundry',
    });

    expect(page.items.map((item) => item.sku)).toEqual(['SKU003']);
  });

  it('reports low stock when the balance is at or below the threshold', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 1, pageSize: 20, q: 'sku003' });

    expect(page.items[0]).toMatchObject({ balance: 0, reorderThreshold: 3, lowStock: true });
  });

  it('does not report low stock when the balance is above the threshold', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 1, pageSize: 20, q: 'sku002' });

    expect(page.items[0]).toMatchObject({ balance: 5, reorderThreshold: 3, lowStock: false });
  });

  it('returns every store, unit and the total count for a cross-store role', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 1, pageSize: 20 });

    expect(page.total).toBe(4);
    expect(new Set(page.items.map((item) => item.storeCode))).toEqual(new Set(['B01', 'B02']));
    expect(page.items.find((item) => item.sku === 'SKU003')?.unit).toBe('bag');
  });

  // Handler AC: "A Manager's search spans every store."
  it('lets a Manager narrow the search to one store', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 1, pageSize: 20, store: 'B02' });

    expect(page.items.map((item) => item.sku)).toEqual(['SKU001']);
    expect(page.items[0]?.storeCode).toBe('B02');
  });

  // Handler AC: "A Store employee's search returns only their assigned store."
  it("forces a Store employee's search to their own store, even including a zero-balance row", async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(staffB01), { page: 1, pageSize: 20 });

    expect(page.total).toBe(3);
    expect(new Set(page.items.map((item) => item.storeCode))).toEqual(new Set(['B01']));
    expect(page.items.find((item) => item.sku === 'SKU003')).toMatchObject({
      balance: 0,
      lowStock: true,
    });
  });

  it('ignores a store filter a Store employee sends for a store other than their own', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(staffB01), { page: 1, pageSize: 20, store: 'B02' });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  // NFR-01/NFR-03: assertStoreAccess is the documented convention for a store-scoped route, and
  // it records the outcome either way.
  it("records an ALLOWED audit entry for a Store employee's own-store search", async () => {
    const prisma = stubPrisma();
    const controller = await createController(prisma);

    await call(controller.list(staffB01), { page: 1, pageSize: 20 });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'u-staff-b01',
        actorRole: 'STORE_EMPLOYEE',
        action: 'stock.list',
        target: 'B01',
        outcome: 'ALLOWED',
      }),
    });
  });

  it('returns no rows and records no audit entry for a Store employee with no store assignment', async () => {
    const storeless: User = { ...staffB01, storeId: null };
    const prisma = stubPrisma();
    const controller = await createController(prisma);

    const page = await call(controller.list(storeless), { page: 1, pageSize: 20 });

    expect(page).toEqual({ items: [], total: 0 });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not audit a cross-store role, which touches no single store', async () => {
    const prisma = stubPrisma();
    const controller = await createController(prisma);

    await call(controller.list(manager), { page: 1, pageSize: 20 });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns an empty page and a zero total for a filter that matches nothing', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), {
      page: 1,
      pageSize: 20,
      q: 'ไม่มีสินค้านี้',
    });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('pages through the rest', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(manager), { page: 2, pageSize: 2 });

    expect(page.items.map((item) => item.sku)).toEqual(['SKU001', 'SKU001']);
    expect(page.total).toBe(4);
  });
});
