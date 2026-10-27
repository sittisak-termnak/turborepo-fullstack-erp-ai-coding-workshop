import { ConfigService } from '@nestjs/config';
import { call } from '@orpc/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { SuppliersController } from './suppliers.controller.js';

// DB-backed, same convention as stores.integration.spec.ts: `code` uniqueness is the real
// database `@unique` constraint, so a stubbed client would only be asserting the stub. Needs a
// reachable database, so it is skipped when DATABASE_URL is unset (the unit-only `test` CI job
// has no Postgres service). The authoritative gate for the Demo line is the `e2e` job's Playwright
// suite; this is the faster local proof of the uniqueness rule.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    '[suppliers.integration.spec] DATABASE_URL unset: skipping the DB-backed uniqueness proof.',
  );
}

describe.skipIf(!databaseUrl)('supplier code uniqueness (integration)', () => {
  // Prefixed so cleanup can never touch the seeded SUP01.
  const prefix = 'TEST-UNIQ-';
  const code = `${prefix}A`;
  let prisma: PrismaService;
  let suppliers: SuppliersController;

  const removeTestSuppliers = async () => {
    await prisma.supplier.deleteMany({ where: { code: { startsWith: prefix } } });
  };

  beforeAll(async () => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
    suppliers = new SuppliersController(prisma);
    await removeTestSuppliers();
  });

  afterAll(async () => {
    await removeTestSuppliers();
    await prisma.$disconnect();
  });

  it('refuses a second supplier claiming a code that is already taken', async () => {
    await expect(
      call(suppliers.create(), { code, name: 'ซัพพลายเออร์ทดสอบ' }),
    ).resolves.toMatchObject({ code });

    await expect(
      call(suppliers.create(), { code, name: 'ซัพพลายเออร์ซ้ำ' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_CODE_TAKEN' });
  });

  it('refuses an edit that moves a supplier onto a code the seeded SUP01 already holds', async () => {
    const moved = await call(suppliers.create(), {
      code: `${prefix}B`,
      name: 'ซัพพลายเออร์ย้ายรหัส',
    });

    await expect(
      call(suppliers.update(), { id: moved.id, code: 'SUP01', name: moved.name }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_CODE_TAKEN' });
  });

  it('lets a supplier keep its own code while its name changes', async () => {
    const supplier = await call(suppliers.create(), {
      code: `${prefix}C`,
      name: 'ชื่อเดิม',
    });

    await expect(
      call(suppliers.update(), { id: supplier.id, code: supplier.code, name: 'ชื่อใหม่' }),
    ).resolves.toMatchObject({ code: supplier.code, name: 'ชื่อใหม่' });
  });
});

// AC: "Seed data creates the §8.1 supplier SUP01 / SupplyOne Co Ltd with phone and address null."
// Reads the real seeded row rather than the DEMO_SUPPLIERS constant, so a bug in the seed script
// itself (not just the constant) would be caught.
describe.skipIf(!databaseUrl)('§8.1 supplier seed data (integration)', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = new PrismaService({ get: () => databaseUrl } as unknown as ConfigService<Env, true>);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeds SUP01 / SupplyOne Co Ltd with null phone and address', async () => {
    const sup01 = await prisma.supplier.findUnique({ where: { code: 'SUP01' } });

    expect(sup01).toMatchObject({ code: 'SUP01', name: 'SupplyOne Co Ltd', phone: null, address: null });
  });
});
