import { describe, expect, it } from 'vitest';
import { AuditOutcomeSchema, AuditRecordSchema } from './audit.js';

describe('AuditOutcomeSchema', () => {
  it.each(['ALLOWED', 'REFUSED'])('accepts %s', (outcome) => {
    expect(AuditOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it('rejects an unknown outcome', () => {
    expect(AuditOutcomeSchema.safeParse('MAYBE').success).toBe(false);
  });
});

describe('AuditRecordSchema', () => {
  const base = {
    id: 'a1',
    actorId: 'u2',
    actorEmail: 'staff_b01@erp.local',
    actorRole: 'STORE_EMPLOYEE',
    action: 'stores.read',
    target: 'B02',
    outcome: 'REFUSED',
    reason: 'store assignment B01 does not match target B02',
    createdAt: '2026-10-26T00:00:00.000Z',
  };

  it('accepts a complete refusal record', () => {
    expect(AuditRecordSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a record whose action names no single target', () => {
    expect(AuditRecordSchema.safeParse({ ...base, target: null, reason: null }).success).toBe(true);
  });

  it('rejects a record carrying an unknown actor role', () => {
    expect(AuditRecordSchema.safeParse({ ...base, actorRole: 'OWNER' }).success).toBe(false);
  });
});
