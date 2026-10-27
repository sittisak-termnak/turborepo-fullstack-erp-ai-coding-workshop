import type { Role } from '@erp/contracts';

/**
 * Which roles may read the audit trail (NFR-03). The trail names who attempted what, so it is
 * sensitive: only roles with explicit audit permission see it. Today that is the Administrator
 * (the user-management role); naming the concept here, rather than scattering `@Roles(...)`
 * strings, keeps "has audit permission" in one place for when a second role earns it.
 */
export const AUDIT_READER_ROLES: readonly Role[] = ['ADMINISTRATOR'];

export function canReadAudit(role: Role): boolean {
  return AUDIT_READER_ROLES.includes(role);
}
