import { oc } from '@orpc/contract';
import * as z from 'zod';

/**
 * The four roles of TOR section 2. They are deliberately flat, not nested: section 2 states an
 * Administrator is not automatically granted transaction approval rights, so only a MANAGER
 * approves purchase orders and adjusts stock.
 */
export const RoleSchema = z.enum([
  'ADMINISTRATOR',
  'PURCHASING_OFFICER',
  'STORE_EMPLOYEE',
  'MANAGER',
]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * How each role is named on screen, in the Thai of TOR section 2. Typed as a total map, so adding
 * a role to `RoleSchema` without naming it breaks the build instead of leaking an enum value into
 * the interface.
 */
export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRATOR: 'ผู้ดูแลระบบ',
  PURCHASING_OFFICER: 'เจ้าหน้าที่จัดซื้อ',
  STORE_EMPLOYEE: 'พนักงานสาขา',
  MANAGER: 'ผู้จัดการ',
};

/** The signed-in user as the API exposes it (never includes the password hash). */
export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: RoleSchema,
});
export type User = z.infer<typeof UserSchema>;

export const LoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const SessionSchema = z.object({
  user: UserSchema.nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const authContract = {
  login: oc
    .route({
      method: 'POST',
      path: '/auth/login',
      summary: 'Sign in with email and password',
      tags: ['Auth'],
    })
    .input(LoginInputSchema)
    .output(UserSchema),
  logout: oc.route({ method: 'POST', path: '/auth/logout', summary: 'Sign out', tags: ['Auth'] }),
  me: oc
    .route({
      method: 'GET',
      path: '/auth/me',
      summary: 'The signed-in user, or null',
      tags: ['Auth'],
    })
    .output(SessionSchema),
};
