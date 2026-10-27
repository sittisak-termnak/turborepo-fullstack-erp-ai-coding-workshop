import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { AuthenticatedRequest } from '../auth/auth.decorators.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { createSessionToken, SESSION_COOKIE } from '../auth/session-token.js';
import { PrismaService } from '../database/prisma.service.js';
import { StoresController } from './stores.controller.js';

const b01 = { id: 'store-b01', code: 'B01', name: 'Branch 01' };
const b02 = { id: 'store-b02', code: 'B02', name: 'Branch 02' };

/** A store as the database holds it: the API shape plus the ordering key. */
type StoreRow = typeof b01 & { createdAt: Date };

const at = (iso: string) => new Date(iso);
const rowsNewestLast: StoreRow[] = [
  { ...b01, createdAt: at('2026-01-01T00:00:00Z') },
  { ...b02, createdAt: at('2026-02-01T00:00:00Z') },
  { id: 'store-b03', code: 'B03', name: 'Branch 03', createdAt: at('2026-03-01T00:00:00Z') },
];

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
const admin: User = {
  id: 'u-admin',
  email: 'admin01@erp.local',
  name: 'Admin One',
  role: 'ADMINISTRATOR',
  storeId: null,
};

/** The unique-violation Prisma raises when two stores claim one code. */
class UniqueViolation extends Error {
  readonly code = 'P2002';
}

/**
 * A small fake of the store table rather than a bag of assertion spies: it applies `where`,
 * `orderBy`, `skip` and `take`, so a test can assert the rows and their order that come back
 * instead of the arguments the handler passed to Prisma. Refactor the query and the tests hold.
 */
function stubPrisma(seed: StoreRow[] = rowsNewestLast, existingProductIds: string[] = []) {
  const rows = [...seed];

  const matches = (row: StoreRow, where?: StoreWhere) => {
    if (!where?.OR) return true;
    return where.OR.some((clause) => {
      const field = clause.code ?? clause.name;
      const value = clause.code ? row.code : row.name;
      return field ? value.toLowerCase().includes(field.contains.toLowerCase()) : true;
    });
  };

  const prisma = {
    store: {
      findUnique: vi.fn(async ({ where }: { where: { code?: string; id?: string } }) =>
        rows.find((row) =>
          where.code === undefined ? row.id === where.id : row.code === where.code,
        ),
      ),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          skip = 0,
          take,
        }: {
          where?: StoreWhere;
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
        async ({ where }: { where?: StoreWhere } = {}) =>
          rows.filter((row) => matches(row, where)).length,
      ),
      create: vi.fn(async ({ data }: { data: { code: string; name: string } }) => {
        if (rows.some((row) => row.code === data.code)) throw new UniqueViolation();
        const created = { id: `store-${data.code.toLowerCase()}`, ...data, createdAt: new Date() };
        rows.push(created);
        return created;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { code: string; name: string };
        }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          if (!row) throw new RecordNotFound();
          if (rows.some((other) => other.id !== where.id && other.code === data.code)) {
            throw new UniqueViolation();
          }
          Object.assign(row, data);
          return row;
        },
      ),
    },
    product: {
      findMany: vi.fn(async () => existingProductIds.map((id) => ({ id }))),
    },
    productStore: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
    auditLog: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
  };
  // A stand-in transaction: hands the same stub back, which is enough to prove the handler asked
  // for store creation and the eager product-store rows together.
  return Object.assign(prisma, {
    $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  });
}

/** The error Prisma raises when `update` addresses a row that is not there. */
class RecordNotFound extends Error {
  readonly code = 'P2025';
}

type StoreWhere = {
  OR?: { code?: { contains: string }; name?: { contains: string } }[];
};

async function createController(prisma: ReturnType<typeof stubPrisma>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [StoresController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(StoresController);
}

describe('StoresController.read', () => {
  let prisma: ReturnType<typeof stubPrisma>;
  beforeEach(() => {
    prisma = stubPrisma();
  });

  it('lets a store employee read their own store', async () => {
    const controller = await createController(prisma);

    await expect(call(controller.read(staffB01), { code: 'B01' })).resolves.toEqual(b01);
  });

  it('records an ALLOWED audit entry when access is granted', async () => {
    const controller = await createController(prisma);

    await call(controller.read(staffB01), { code: 'B01' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'u-staff-b01',
        actorEmail: 'staff_b01@erp.local',
        actorRole: 'STORE_EMPLOYEE',
        action: 'stores.read',
        target: 'B01',
        outcome: 'ALLOWED',
      }),
    });
  });

  it('refuses a store employee a store other than their assignment', async () => {
    const controller = await createController(prisma);

    await expect(call(controller.read(staffB01), { code: 'B02' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('records a REFUSED audit entry carrying actor, target and outcome', async () => {
    const controller = await createController(prisma);

    await call(controller.read(staffB01), { code: 'B02' }).catch(() => undefined);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'u-staff-b01',
        actorRole: 'STORE_EMPLOYEE',
        action: 'stores.read',
        target: 'B02',
        outcome: 'REFUSED',
      }),
    });
  });

  it('lets a Manager read any store', async () => {
    const controller = await createController(prisma);

    await expect(call(controller.read(manager), { code: 'B02' })).resolves.toEqual(b02);
  });

  it('lets an Administrator read any store', async () => {
    const controller = await createController(prisma);

    await expect(call(controller.read(admin), { code: 'B02' })).resolves.toEqual(b02);
  });

  it('returns NOT_FOUND for a store code that does not exist', async () => {
    const controller = await createController(prisma);

    await expect(call(controller.read(admin), { code: 'B99' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('StoresController.list', () => {
  it('orders the page newest first', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20 });

    expect(page.items.map((store) => store.code)).toEqual(['B03', 'B02', 'B01']);
  });

  it('returns one page together with the total of everything that matched', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 2 });

    expect(page.items.map((store) => store.code)).toEqual(['B03', 'B02']);
    expect(page.total).toBe(3);
  });

  it('pages through the rest', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 2, pageSize: 2 });

    expect(page.items.map((store) => store.code)).toEqual(['B01']);
    expect(page.total).toBe(3);
  });

  it('filters on the code, case-insensitively', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20, q: 'b02' });

    expect(page.items.map((store) => store.code)).toEqual(['B02']);
    expect(page.total).toBe(1);
  });

  it('filters on the name too', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20, q: 'Branch 03' });

    expect(page.items.map((store) => store.code)).toEqual(['B03']);
  });

  it('returns an empty page and a zero total for a filter that matches nothing', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20, q: 'ไม่มีสาขานี้' });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('never returns the ordering key the database sorts on', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 1 });

    expect(page.items[0]).toEqual({ id: 'store-b03', code: 'B03', name: 'Branch 03' });
  });
});

describe('StoresController.create', () => {
  it('creates a store and returns it', async () => {
    const controller = await createController(stubPrisma());

    await expect(call(controller.create(), { code: 'B04', name: 'Branch 04' })).resolves.toEqual({
      id: 'store-b04',
      code: 'B04',
      name: 'Branch 04',
    });
  });

  it('refuses a code another store already uses, with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.create(), { code: 'B01', name: 'Branch 01 again' }),
    ).rejects.toMatchObject({ code: 'STORE_CODE_TAKEN' });
  });

  // #7's eager-creation rule, the mirror image of ProductsController.create's own test: a new
  // store gets a product-store row for every existing product.
  it('creates a product-store record for every existing product', async () => {
    const prisma = stubPrisma(rowsNewestLast, ['product-water', 'product-tissue']);
    const controller = await createController(prisma);

    const store = await call(controller.create(), { code: 'B04', name: 'Branch 04' });

    expect(prisma.productStore.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'product-water', storeId: store.id },
        { productId: 'product-tissue', storeId: store.id },
      ],
    });
  });

  it('creates no product-store rows when there are no products yet', async () => {
    const prisma = stubPrisma(rowsNewestLast, []);
    const controller = await createController(prisma);

    await call(controller.create(), { code: 'B04', name: 'Branch 04' });

    expect(prisma.productStore.createMany).not.toHaveBeenCalled();
  });
});

describe('StoresController.update', () => {
  it('edits the code and the name', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'store-b01', code: 'B01X', name: 'Branch 01 renamed' }),
    ).resolves.toEqual({ id: 'store-b01', code: 'B01X', name: 'Branch 01 renamed' });
  });

  it('refuses a code another store already uses', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'store-b01', code: 'B02', name: 'Branch 01' }),
    ).rejects.toMatchObject({ code: 'STORE_CODE_TAKEN' });
  });

  it('keeps its own code, which is not a clash with itself', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'store-b01', code: 'B01', name: 'Branch 01 renamed' }),
    ).resolves.toMatchObject({ code: 'B01', name: 'Branch 01 renamed' });
  });

  it('reports a store that is no longer there with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'store-gone', code: 'B09', name: 'Branch 09' }),
    ).rejects.toMatchObject({ code: 'STORE_NOT_FOUND' });
  });
});

// AC-02. The guard, not the handler, decides role access, and it does not run in a controller
// spec. So this drives the real AuthGuard over the real controller methods: the decorators under
// test are the ones the application ships. Mirrors src/auth/auth.guard.spec.ts.
describe('store maintenance is administrator-only', () => {
  const secret = 'test-secret-that-is-at-least-32-characters';

  function runGuard(route: 'list' | 'create' | 'update' | 'read', user: User) {
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
      getHandler: () => StoresController.prototype[route],
      getClass: () => StoresController,
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
    await expect(runGuard(route, staffB01)).rejects.toBeInstanceOf(ForbiddenException);
  });

  // #4's store-scoped read stays open to every signed-in role; only maintenance is restricted.
  it('still lets a store employee reach read, which scopes itself in the handler', async () => {
    await expect(runGuard('read', staffB01)).resolves.toBe(true);
  });
});
