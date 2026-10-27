import { Role } from './generated/prisma/client.js';

/**
 * The two RetailOne branches of TOR section 8.1 (MD-03). `code` is the business key read on
 * documents; the seed creates these before the users so a store employee can be assigned to one.
 */
export const DEMO_STORES = [
  { code: 'B01', name: 'Branch 01' },
  { code: 'B02', name: 'Branch 02' },
] as const;

/**
 * The workshop demo accounts. The four named in TOR section 8.1 (buyer01, staff_b01, staff_b02,
 * manager01) carry the roles section 2 defines for them; section 8.1 gives usernames, so the
 * email is derived from each.
 *
 * admin01 is additional: section 8.1 names no administrator, but MD-01 to MD-03 cannot be
 * demonstrated without one.
 *
 * `storeCode` is the single store assignment: required for a STORE_EMPLOYEE, absent (undefined)
 * for the cross-store roles (ADMINISTRATOR, MANAGER, PURCHASING_OFFICER). The seed resolves it to
 * the store's id. The database cannot express "required for one role only", so this pairing is the
 * place the rule is asserted for the demo data.
 */
export const DEMO_USERS = [
  { email: 'admin01@erp.local', name: 'Admin One', role: Role.ADMINISTRATOR },
  { email: 'buyer01@erp.local', name: 'Buyer One', role: Role.PURCHASING_OFFICER },
  { email: 'staff_b01@erp.local', name: 'Staff B01', role: Role.STORE_EMPLOYEE, storeCode: 'B01' },
  { email: 'staff_b02@erp.local', name: 'Staff B02', role: Role.STORE_EMPLOYEE, storeCode: 'B02' },
  { email: 'manager01@erp.local', name: 'Manager One', role: Role.MANAGER },
] as const;

/** Non-production demo password, per NFR-02. */
export const DEMO_PASSWORD = 'password';
