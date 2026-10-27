import path from 'node:path';

// Demo accounts from packages/database/src/demo-users.ts, seeded by
// packages/database/prisma/seed.ts. Tests never create users; they sign in as one of
// these through the saved storage state. Every key here costs one setup step, so this
// holds only the accounts a test actually uses.
export const DEMO_PASSWORD = 'password';

export const accounts = {
  admin: { email: 'admin01@erp.local', name: 'Admin One', role: 'ADMINISTRATOR' },
  staff: { email: 'staff_b01@erp.local', name: 'Staff B01', role: 'STORE_EMPLOYEE' },
} as const;

export type AccountName = keyof typeof accounts;

/** Where auth.setup.ts saves each account's cookies. Gitignored. */
export function storageState(name: AccountName) {
  return path.resolve(import.meta.dirname, '..', '.auth', `${name}.json`);
}
