import { Test } from '@nestjs/testing';
import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { StoresController } from './stores.controller.js';

const b01 = { id: 'store-b01', code: 'B01', name: 'Branch 01' };
const b02 = { id: 'store-b02', code: 'B02', name: 'Branch 02' };

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

function stubPrisma() {
  const byCode: Record<string, typeof b01 | undefined> = { B01: b01, B02: b02 };
  return {
    store: { findUnique: vi.fn(({ where }: { where: { code: string } }) => byCode[where.code]) },
    auditLog: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
  };
}

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
