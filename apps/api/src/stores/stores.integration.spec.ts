import { ConfigService } from '@nestjs/config';
import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditController } from '../audit/audit.controller.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { StoresController } from './stores.controller.js';

// DB-backed. Runs against the Dockerised Postgres the API already uses, with the seeded TOR
// data (stores B01/B02, staff_b01 -> B01, staff_b02 -> B02, admin01 cross-store). Verifies the
// rule end to end: enforcement at the API and a real row in the audit trail, not a stubbed call.
//
// This needs a reachable database, so it is skipped when DATABASE_URL is unset (e.g. the unit-only
// `test` CI job, which has no Postgres service). It is NOT the authoritative CI gate for the Demo
// line: that is store-scope.e2e.ts in the `e2e` job, which runs against a real Postgres. This spec
// is the faster local proof of the same guarantee. The skip is announced below so a skipped run is
// never mistaken for a passing one.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    '[stores.integration.spec] DATABASE_URL unset: skipping the DB-backed store-scope proof. ' +
      'The authoritative gate is store-scope.e2e.ts in the e2e job.',
  );
}

async function loadUser(prisma: PrismaService, email: string): Promise<User> {
  const row = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, email: true, name: true, role: true, storeId: true },
  });
  return row;
}

describe.skipIf(!databaseUrl)('store-scoped authorisation (integration)', () => {
  let prisma: PrismaService;
  let stores: StoresController;
  let audit: AuditController;
  let staffB01: User;
  let admin: User;

  beforeAll(async () => {
    prisma = new PrismaService({
      get: () => databaseUrl,
    } as unknown as ConfigService<Env, true>);
    stores = new StoresController(prisma);
    audit = new AuditController(prisma);
    staffB01 = await loadUser(prisma, 'staff_b01@erp.local');
    admin = await loadUser(prisma, 'admin01@erp.local');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeds a store employee with exactly one store assignment', () => {
    expect(staffB01.storeId).not.toBeNull();
    expect(admin.storeId).toBeNull();
  });

  it('lets a store employee read their own store', async () => {
    await expect(call(stores.read(staffB01), { code: 'B01' })).resolves.toMatchObject({
      code: 'B01',
    });
  });

  it('refuses a store employee a store other than their assignment, and records it', async () => {
    const before = await prisma.auditLog.count({
      where: { actorId: staffB01.id, action: 'stores.read', target: 'B02', outcome: 'REFUSED' },
    });

    await expect(call(stores.read(staffB01), { code: 'B02' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const after = await prisma.auditLog.findFirst({
      where: { actorId: staffB01.id, action: 'stores.read', target: 'B02', outcome: 'REFUSED' },
      orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.auditLog.count({
      where: { actorId: staffB01.id, action: 'stores.read', target: 'B02', outcome: 'REFUSED' },
    });

    expect(total).toBe(before + 1);
    expect(after).toMatchObject({
      actorEmail: 'staff_b01@erp.local',
      actorRole: 'STORE_EMPLOYEE',
      outcome: 'REFUSED',
    });
    expect(after?.createdAt).toBeInstanceOf(Date);
  });

  it('surfaces the refusal to an Administrator reading the audit trail', async () => {
    await call(stores.read(staffB01), { code: 'B02' }).catch(() => undefined);

    const records = await call(audit.list(), undefined);
    const refusal = records.find(
      (r) => r.actorId === staffB01.id && r.target === 'B02' && r.outcome === 'REFUSED',
    );

    expect(refusal).toBeDefined();
  });
});

// AC-06. Uniqueness is the database's `@unique` on Store.code, so a stubbed client would be
// asserting the stub. These two cases are the reason the handler lets the constraint decide
// instead of reading first. Same skip rule and same authoritative-gate note as above.
describe.skipIf(!databaseUrl)('store code uniqueness (integration)', () => {
  // Prefixed so cleanup can never touch a seeded store.
  const prefix = 'TEST-UNIQ-';
  const code = `${prefix}A`;
  let prisma: PrismaService;
  let stores: StoresController;

  // #7: creating a store now eagerly creates a product-store row for every existing product, so
  // a test store's rows must go before the store itself can.
  const removeTestStores = async () => {
    await prisma.productStore.deleteMany({ where: { store: { code: { startsWith: prefix } } } });
    await prisma.store.deleteMany({ where: { code: { startsWith: prefix } } });
  };

  beforeAll(async () => {
    prisma = new PrismaService({
      get: () => databaseUrl,
    } as unknown as ConfigService<Env, true>);
    stores = new StoresController(prisma);
    await removeTestStores();
  });

  afterAll(async () => {
    await removeTestStores();
    await prisma.$disconnect();
  });

  it('refuses a second store claiming a code that is already taken', async () => {
    await expect(call(stores.create(), { code, name: 'สาขาทดสอบ' })).resolves.toMatchObject({
      code,
    });

    await expect(call(stores.create(), { code, name: 'สาขาซ้ำ' })).rejects.toMatchObject({
      code: 'STORE_CODE_TAKEN',
    });
  });

  it('refuses an edit that moves a store onto a code the seeded B01 already holds', async () => {
    const moved = await call(stores.create(), { code: `${prefix}B`, name: 'สาขาย้ายรหัส' });

    await expect(
      call(stores.update(), { id: moved.id, code: 'B01', name: moved.name }),
    ).rejects.toMatchObject({ code: 'STORE_CODE_TAKEN' });
  });

  it('lets a store keep its own code while its name changes', async () => {
    const store = await call(stores.create(), { code: `${prefix}C`, name: 'ชื่อเดิม' });

    await expect(
      call(stores.update(), { id: store.id, code: store.code, name: 'ชื่อใหม่' }),
    ).resolves.toMatchObject({ code: store.code, name: 'ชื่อใหม่' });
  });
});
