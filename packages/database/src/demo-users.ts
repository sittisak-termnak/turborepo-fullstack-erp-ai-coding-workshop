import { Role } from './generated/prisma/client.js';

/**
 * The workshop demo accounts. The four named in TOR section 8.1 (buyer01, staff_b01, staff_b02,
 * manager01) carry the roles section 2 defines for them; section 8.1 gives usernames, so the
 * email is derived from each.
 *
 * admin01 is additional: section 8.1 names no administrator, but MD-01 to MD-03 cannot be
 * demonstrated without one.
 *
 * Store assignment is not here yet. staff_b01 and staff_b02 belong to stores B01 and B02, which
 * arrives with the store concept in a later ticket.
 */
export const DEMO_USERS = [
  { email: 'admin01@erp.local', name: 'Admin One', role: Role.ADMINISTRATOR },
  { email: 'buyer01@erp.local', name: 'Buyer One', role: Role.PURCHASING_OFFICER },
  { email: 'staff_b01@erp.local', name: 'Staff B01', role: Role.STORE_EMPLOYEE },
  { email: 'staff_b02@erp.local', name: 'Staff B02', role: Role.STORE_EMPLOYEE },
  { email: 'manager01@erp.local', name: 'Manager One', role: Role.MANAGER },
] as const;

/** Non-production demo password, per NFR-02. */
export const DEMO_PASSWORD = 'password';
