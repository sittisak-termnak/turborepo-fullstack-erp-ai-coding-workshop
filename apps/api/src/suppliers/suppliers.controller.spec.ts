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
import { SuppliersController } from './suppliers.controller.js';

const sup01 = { id: 'supplier-sup01', code: 'SUP01', name: 'SupplyOne Co Ltd', phone: null, address: null };
const sup02 = { id: 'supplier-sup02', code: 'SUP02', name: 'Supplier Two', phone: '02-111-2222', address: '1 ถนนสุขุมวิท' };

type SupplierRow = typeof sup01 & { createdAt: Date };

const at = (iso: string) => new Date(iso);
const rowsNewestLast: SupplierRow[] = [
  { ...sup01, createdAt: at('2026-01-01T00:00:00Z') },
  { ...sup02, createdAt: at('2026-02-01T00:00:00Z') },
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

/** The unique-violation Prisma raises when two suppliers claim one code. */
class UniqueViolation extends Error {
  readonly code = 'P2002';
}

/** The error Prisma raises when `update` addresses a row that is not there. */
class RecordNotFound extends Error {
  readonly code = 'P2025';
}

/**
 * A small fake of the supplier table, in the same shape as stores.controller.spec.ts's
 * `stubPrisma`: it applies `orderBy`, `skip` and `take`, so a test asserts the rows and order
 * that come back rather than the arguments passed to Prisma.
 */
function stubPrisma(seed: SupplierRow[] = rowsNewestLast) {
  const rows = [...seed];

  return {
    supplier: {
      findMany: vi.fn(
        async ({
          orderBy,
          skip = 0,
          take,
        }: {
          orderBy?: { createdAt?: 'asc' | 'desc' };
          skip?: number;
          take?: number;
        }) => {
          const found = [...rows];
          const direction = orderBy?.createdAt === 'asc' ? 1 : -1;
          found.sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()));
          return found.slice(skip, take === undefined ? undefined : skip + take);
        },
      ),
      count: vi.fn(async () => rows.length),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { code: string; name: string; phone: string | null; address: string | null };
        }) => {
          if (rows.some((row) => row.code === data.code)) throw new UniqueViolation();
          const created = {
            id: `supplier-${data.code.toLowerCase()}`,
            ...data,
            createdAt: new Date(),
          };
          rows.push(created);
          return created;
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<SupplierRow> }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          if (!row) throw new RecordNotFound();
          if (data.code && rows.some((other) => other.id !== where.id && other.code === data.code)) {
            throw new UniqueViolation();
          }
          Object.assign(row, data);
          return row;
        },
      ),
    },
  };
}

async function createController(prisma: ReturnType<typeof stubPrisma>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SuppliersController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(SuppliersController);
}

describe('SuppliersController.list', () => {
  it('orders the page newest first', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20 });

    expect(page.items.map((supplier) => supplier.code)).toEqual(['SUP02', 'SUP01']);
  });

  it('returns one page together with the total of everything that matched', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 1 });

    expect(page.items.map((supplier) => supplier.code)).toEqual(['SUP02']);
    expect(page.total).toBe(2);
  });

  it('pages through the rest', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 2, pageSize: 1 });

    expect(page.items.map((supplier) => supplier.code)).toEqual(['SUP01']);
    expect(page.total).toBe(2);
  });

  it('returns an empty page and a zero total when there are no suppliers', async () => {
    const controller = await createController(stubPrisma([]));

    const page = await call(controller.list(), { page: 1, pageSize: 20 });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('carries the null contact details the §8.1 seed row has', async () => {
    const controller = await createController(stubPrisma());

    const page = await call(controller.list(), { page: 1, pageSize: 20 });

    expect(page.items.find((supplier) => supplier.code === 'SUP01')).toMatchObject({
      phone: null,
      address: null,
    });
  });
});

describe('SuppliersController.create', () => {
  it('creates a supplier with a code, a name, and contact details', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.create(), {
        code: 'SUP03',
        name: 'Supplier Three',
        phone: '02-333-4444',
        address: '3 ถนนพระราม 4',
      }),
    ).resolves.toEqual({
      id: 'supplier-sup03',
      code: 'SUP03',
      name: 'Supplier Three',
      phone: '02-333-4444',
      address: '3 ถนนพระราม 4',
    });
  });

  it('creates a supplier with no contact details as null, not undefined', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.create(), { code: 'SUP03', name: 'Supplier Three' }),
    ).resolves.toMatchObject({ phone: null, address: null });
  });

  it('refuses a code another supplier already uses, with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.create(), { code: 'SUP01', name: 'Supplier One Again' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_CODE_TAKEN' });
  });
});

describe('SuppliersController.update', () => {
  it('edits the code, name and contact details', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), {
        id: 'supplier-sup01',
        code: 'SUP01',
        name: 'SupplyOne Co Ltd',
        phone: '02-111-2222',
        address: '1 ถนนสุขุมวิท',
      }),
    ).resolves.toMatchObject({ phone: '02-111-2222', address: '1 ถนนสุขุมวิท' });
  });

  it('refuses a code another supplier already uses', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'supplier-sup01', code: 'SUP02', name: 'SupplyOne Co Ltd' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_CODE_TAKEN' });
  });

  it('keeps its own code, which is not a clash with itself', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'supplier-sup01', code: 'SUP01', name: 'SupplyOne Co Ltd renamed' }),
    ).resolves.toMatchObject({ code: 'SUP01', name: 'SupplyOne Co Ltd renamed' });
  });

  it('reports a supplier that is no longer there with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.update(), { id: 'supplier-gone', code: 'SUP09', name: 'Ghost Supplier' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_NOT_FOUND' });
  });
});

// Supplier maintenance is the Administrator's screen (MD-03), mirroring stores.controller.spec.ts
// and products.controller.spec.ts.
describe('supplier maintenance is administrator-only', () => {
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
      getHandler: () => SuppliersController.prototype[route],
      getClass: () => SuppliersController,
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
