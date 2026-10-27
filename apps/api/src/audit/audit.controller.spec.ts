import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { call } from '@orpc/server';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuditController } from './audit.controller.js';

const record = {
  id: 'a1',
  actorId: 'u2',
  actorEmail: 'staff_b01@erp.local',
  actorRole: 'STORE_EMPLOYEE',
  action: 'stores.read',
  target: 'B02',
  outcome: 'REFUSED',
  reason: 'store assignment store-b01 does not match target B02',
  createdAt: new Date('2026-10-26T00:00:00.000Z'),
};

async function createController(findMany = vi.fn().mockResolvedValue([record])) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuditController],
    providers: [{ provide: PrismaService, useValue: { auditLog: { findMany } } }],
  }).compile();
  return { controller: moduleRef.get(AuditController), findMany };
}

describe('AuditController.list', () => {
  it('returns audit records with the timestamp serialised to ISO', async () => {
    const { controller } = await createController();

    const result = await call(controller.list(), undefined);

    expect(result).toEqual([{ ...record, createdAt: '2026-10-26T00:00:00.000Z' }]);
  });

  it('reads newest first', async () => {
    const { controller, findMany } = await createController();

    await call(controller.list(), undefined);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  // The read is gated by role at the guard. This asserts the gate is declared so no role without
  // audit permission can reach the handler.
  it('is restricted to the Administrator role', () => {
    const roles = new Reflector().get<string[]>(ROLES_KEY, AuditController.prototype.list);

    expect(roles).toEqual(['ADMINISTRATOR']);
  });
});
