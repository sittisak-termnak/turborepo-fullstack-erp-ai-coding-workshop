import type { Role } from '@erp/contracts';
import { describe, expect, it } from 'vitest';
import { canReadAudit } from './audit-permission.js';

describe('canReadAudit', () => {
  it('lets an Administrator read the audit trail', () => {
    expect(canReadAudit('ADMINISTRATOR')).toBe(true);
  });

  // NFR-03: the trail is sensitive. A role without explicit audit permission cannot read it,
  // including the Manager, whose approval rights do not extend to the audit trail.
  it.each(['MANAGER', 'PURCHASING_OFFICER', 'STORE_EMPLOYEE'] as const)(
    'refuses %s without audit permission',
    (role: Role) => {
      expect(canReadAudit(role)).toBe(false);
    },
  );
});
