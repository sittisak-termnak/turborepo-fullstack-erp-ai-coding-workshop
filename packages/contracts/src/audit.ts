import { oc } from '@orpc/contract';
import * as z from 'zod';
import { RoleSchema } from './auth.js';

/** Why an audited action ended the way it did. */
export const AuditOutcomeSchema = z.enum(['ALLOWED', 'REFUSED']);
export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;

/**
 * One recorded authorisation outcome (NFR-03). The actor is kept as plain columns, not a
 * relation, so deleting a user never erases the trail.
 */
export const AuditRecordSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorEmail: z.email(),
  actorRole: RoleSchema,
  action: z.string(),
  target: z.string().nullable(),
  outcome: AuditOutcomeSchema,
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

export const auditContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/audit',
      summary: 'List audit records, newest first (requires audit permission)',
      tags: ['Audit'],
    })
    .output(z.array(AuditRecordSchema)),
};
