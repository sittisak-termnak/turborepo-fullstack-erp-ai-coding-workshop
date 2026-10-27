import type { Role, User } from '@erp/contracts';
import { ORPCError } from '@orpc/nest';
import type { PrismaService } from '../database/prisma.service.js';

/**
 * The documented store-scope convention (NFR-01).
 *
 * The global AuthGuard runs before the handler and authenticates the user, but it cannot see the
 * request payload, so it cannot decide row-level access. Row-level rules are therefore enforced
 * here, inside the handler, once the target entity is loaded. Every handler that touches
 * store-scoped data calls this, so no route can quietly omit the second half of the pairing.
 *
 * Hiding a button is never enforcement: this refuses the request at the API and records the
 * outcome, whether allowed or refused, to the audit trail (NFR-03).
 */

/** Roles that are explicitly cross-store and never restricted to a single store. */
const CROSS_STORE_ROLES: readonly Role[] = ['ADMINISTRATOR', 'MANAGER', 'PURCHASING_OFFICER'];

export function isCrossStore(role: Role): boolean {
  return CROSS_STORE_ROLES.includes(role);
}

/** True when `user` may act on the store identified by `targetStoreId`. */
export function mayAccessStore(user: User, targetStoreId: string): boolean {
  return isCrossStore(user.role) || user.storeId === targetStoreId;
}

/**
 * Assert that `user` may act on `targetStoreId`, recording the outcome either way. On refusal,
 * writes a REFUSED audit record and throws FORBIDDEN; on success, writes an ALLOWED record.
 * `target` is the human-facing identifier recorded in the trail (e.g. a store code).
 *
 * The ticket's acceptance criterion names only refusals, but NFR-03 records *outcomes* and the
 * AuditLog schema ships an ALLOWED value for exactly this: recording both keeps the trail a
 * complete account of who reached what, not just a list of denials. This is a deliberate choice,
 * not an accident of the helper.
 */
export async function assertStoreAccess(
  prisma: PrismaService,
  user: User,
  args: { action: string; target: string; targetStoreId: string },
): Promise<void> {
  const allowed = mayAccessStore(user, args.targetStoreId);
  const reason = allowed
    ? null
    : `store assignment ${user.storeId ?? 'none'} does not match target ${args.target}`;

  await writeAudit(prisma, user, {
    action: args.action,
    target: args.target,
    outcome: allowed ? 'ALLOWED' : 'REFUSED',
    reason,
  });

  if (!allowed) {
    throw new ORPCError('FORBIDDEN', { message: 'You are not assigned to that store' });
  }
}

/** Append one record to the audit trail. */
export async function writeAudit(
  prisma: PrismaService,
  user: User,
  entry: {
    action: string;
    target: string | null;
    outcome: 'ALLOWED' | 'REFUSED';
    reason: string | null;
  },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: entry.action,
      target: entry.target,
      outcome: entry.outcome,
      reason: entry.reason,
    },
  });
}
