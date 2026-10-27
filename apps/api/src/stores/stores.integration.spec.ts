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
