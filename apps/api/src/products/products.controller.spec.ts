import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { AuthenticatedRequest } from '../auth/auth.decorators.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { createSessionToken, SESSION_COOKIE } from '../auth/session-token.js';
import { PrismaService } from '../database/prisma.service.js';
import { ProductsController } from './products.controller.js';

const water = {
  id: 'product-water',
  sku: 'SKU001',
  name: 'Drinking water pack of 6',
  category: 'Beverages',
  unit: 'pack',
  sellingPrice: 60,
  active: true,
};
const tissue = {
  id: 'product-tissue',
  sku: 'SKU002',
  name: 'Tissue paper',
  category: 'Household',
  unit: 'pack',
  sellingPrice: 35,
  active: true,
};
const detergentInactive = {
  id: 'product-detergent',
  sku: 'SKU003',
  name: 'Laundry detergent',
  category: 'Cleaning',
  unit: 'bag',
  sellingPrice: 120,
  active: false,
};

type ProductRow = typeof water & { createdAt: Date };

const at = (iso: string) => new Date(iso);
const rowsNewestLast: ProductRow[] = [
  { ...water, createdAt: at('2026-01-01T00:00:00Z') },
  { ...tissue, createdAt: at('2026-02-01T00:00:00Z') },
  { ...detergentInactive, createdAt: at('2026-03-01T00:00:00Z') },
];

const admin: User = {
  id: 'u-admin',
  email: 'admin01@erp.local',
  name: 'Admin One',
  role: 'ADMINISTRATOR',
  storeId: null,
};
const manager: User = {
  id: 'u-mgr',
  email: 'manager01@erp.local',
  name: 'Manager One',
  role: 'MANAGER',
  storeId: null,
};
const staff: User = {
  id: 'u-staff',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-b01',
};

/** The unique-violation Prisma raises when two products claim one SKU. */
class UniqueViolation extends Error {
  readonly code = 'P2002';
}

/** The error Prisma raises when `update` addresses a row that is not there. */
class RecordNotFound extends Error {
  readonly code = 'P2025';
}

type ProductFilterClause = {
  sku?: { contains: string };
  name?: { contains: string };
  category?: { contains: string };
};
type ProductWhere = { OR?: ProductFilterClause[]; active?: boolean };

/**
 * A small fake of the product table, in the same shape as stores.controller.spec.ts's
 * `stubPrisma`: it applies `where`, `orderBy`, `skip` and `take`, so a test asserts the rows
 * and order that come back rather than the arguments passed to Prisma.
 */
function stubPrisma(seed: ProductRow[] = rowsNewestLast, existingStoreIds: string[] = []) {
  const rows = [...seed];

  const textMatches = (row: ProductRow, clause: ProductFilterClause) => {
    const field = clause.sku ?? clause.name ?? clause.category;
    const value = clause.sku ? row.sku : clause.name ? row.name : row.category;
    return field ? value.toLowerCase().includes(field.contains.toLowerCase()) : true;
  };

  const matches = (row: ProductRow, where?: ProductWhere) => {
    if (!where) return true;
    if (where.active !== undefined && row.active !== where.active) return false;
    if (where.OR && !where.OR.some((clause) => textMatches(row, clause))) return false;
    return true;
  };

  const prisma = {
    product: {
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          skip = 0,
          take,
        }: {
          where?: ProductWhere;
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
        async ({ where }: { where?: ProductWhere } = {}) =>
          rows.filter((row) => matches(row, where)).length,
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            sku: string;
            name: string;
            category: string;
            unit: string;
            sellingPrice: number;
            active: boolean;
          };
        }) => {
          if (rows.some((row) => row.sku === data.sku)) throw new UniqueViolation();
          const created = {
            id: `product-${data.sku.toLowerCase()}`,
            ...data,
            createdAt: new Date(),
          };
          rows.push(created);
          return created;
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<ProductRow> }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          if (!row) throw new RecordNotFound();
          if (data.sku && rows.some((other) => other.id !== where.id && other.sku === data.sku)) {
            throw new UniqueViolation();
          }
          Object.assign(row, data);
          return row;
        },
      ),
    },
    store: {
      findMany: vi.fn(async () => existingStoreIds.map((id) => ({ id }))),
    },
    productStore: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
  };
  // A stand-in transaction: hands the same stub back, which is enough to prove the handler asked
  // for product creation and the eager product-store rows together.
  return Object.assign(prisma, {
    $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  });
}

async function createController(prisma: ReturnType<typeof stubPrisma>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProductsController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(ProductsController);
}

describe('ProductsController.list', () => {
  it('orders the page newest first', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20 });

    expect(page.items.map((p) => p.sku)).toEqual(['SKU003', 'SKU002', 'SKU001']);
  });

  it('filters on the sku, name or category, case-insensitively', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20, q: 'tissue' });

    expect(page.items.map((p) => p.sku)).toEqual(['SKU002']);
  });

  // MD-02: a deactivated product remains findable in search, which omits the active filter.
  it('finds a deactivated product when no active filter is given', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20, q: 'detergent' });

    expect(page.items.map((p) => p.sku)).toEqual(['SKU003']);
  });

  // MD-02: inactive products cannot be added to a new document. This is the one seam that rule
  // reaches in this ticket: the product disappears from the active-only list a document's
  // product picker would ask for.
  it('excludes a deactivated product when the caller asks for active products only', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20, active: true });

    expect(page.items.map((p) => p.sku).sort()).toEqual(['SKU001', 'SKU002']);
  });

  it('returns the selling price as a plain number', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 1, q: 'SKU001' });

    expect(page.items[0]).toMatchObject({ sku: 'SKU001', sellingPrice: 60 });
  });
});

describe('ProductsController.create', () => {
  it('creates a product with every MD-01 field', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.create(), {
        sku: 'SKU004',
        name: 'Instant noodles',
        category: 'Food',
        unit: 'pack',
        sellingPrice: 15,
        active: true,
      }),
    ).resolves.toMatchObject({ sku: 'SKU004', name: 'Instant noodles', sellingPrice: 15 });
  });

  it('refuses a sku another product already uses, with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.create(), {
        sku: 'SKU001',
        name: 'Another water',
        category: 'Beverages',
        unit: 'pack',
        sellingPrice: 1,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_SKU_TAKEN' });
  });

  // The ticket's own eager-creation rule: a new product-store row for every existing store.
  it('creates a product-store record for every existing store', async () => {
    const prisma = stubPrisma(rowsNewestLast, ['store-b01', 'store-b02']);
    const controller = await createController(prisma);

    const product = await call(controller.create(), {
      sku: 'SKU004',
      name: 'Instant noodles',
      category: 'Food',
      unit: 'pack',
      sellingPrice: 15,
      active: true,
    });

    expect(prisma.productStore.createMany).toHaveBeenCalledWith({
      data: [
        { productId: product.id, storeId: 'store-b01' },
        { productId: product.id, storeId: 'store-b02' },
      ],
    });
  });

  it('creates no product-store rows when there are no stores yet', async () => {
    const prisma = stubPrisma(rowsNewestLast, []);
    const controller = await createController(prisma);

    await call(controller.create(), {
      sku: 'SKU004',
      name: 'Instant noodles',
      category: 'Food',
      unit: 'pack',
      sellingPrice: 15,
      active: true,
    });

    expect(prisma.productStore.createMany).not.toHaveBeenCalled();
  });
});

describe('ProductsController.update', () => {
  it('edits a product, including deactivating it', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), {
        id: 'product-detergent',
        sku: 'SKU003',
        name: 'Laundry detergent',
        category: 'Cleaning',
        unit: 'bag',
        sellingPrice: 120,
        active: false,
      }),
    ).resolves.toMatchObject({ active: false });
  });

  it('refuses a sku another product already uses', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), {
        id: 'product-water',
        sku: 'SKU002',
        name: 'Drinking water pack of 6',
        category: 'Beverages',
        unit: 'pack',
        sellingPrice: 60,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_SKU_TAKEN' });
  });

  it('reports a product that is no longer there with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), {
        id: 'product-gone',
        sku: 'SKU099',
        name: 'Ghost',
        category: 'Food',
        unit: 'pack',
        sellingPrice: 1,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });
});

// Product maintenance is the Administrator's screen (MD-01), mirroring stores.controller.spec.ts.
describe('product maintenance is administrator-only', () => {
  const secret = 'test-secret-that-is-at-least-32-characters';

  function runGuard(route: 'list' | 'create' | 'update', user: User) {
    const guard = new AuthGuard(
      new Reflector(),
      { user: { findUnique: vi.fn().mockResolvedValue(user) } } as unknown as PrismaService,
      { get: () => secret } as unknown as ConfigService<Env, true>,
    );
    const request = {
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(user.id, secret)}` },
    } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ProductsController.prototype[route],
      getClass: () => ProductsController,
    } as unknown as ExecutionContext;

    return guard.canActivate(context);
  }

  it.each(['list', 'create', 'update'] as const)(
    'lets an Administrator reach %s',
    async (route) => {
      await expect(runGuard(route, admin)).resolves.toBe(true);
    },
  );

  it.each(['list', 'create', 'update'] as const)('refuses a Manager %s', async (route) => {
    await expect(runGuard(route, manager)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['list', 'create', 'update'] as const)('refuses a store employee %s', async (route) => {
    await expect(runGuard(route, staff)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
