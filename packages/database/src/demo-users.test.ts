import { describe, expect, it } from 'vitest';
import { DEMO_USERS } from './demo-users.js';

/**
 * Expected values come from TOR section 8.1, which names the test users, and section 2,
 * which defines their roles. Store assignment is not asserted here: the store concept and
 * the user-to-store column arrive in a later ticket.
 */
describe('DEMO_USERS', () => {
  it.each([
    ['buyer01@erp.local', 'PURCHASING_OFFICER'],
    ['staff_b01@erp.local', 'STORE_EMPLOYEE'],
    ['staff_b02@erp.local', 'STORE_EMPLOYEE'],
    ['manager01@erp.local', 'MANAGER'],
  ])('seeds %s as %s', (email, role) => {
    expect(DEMO_USERS.find((user) => user.email === email)?.role).toBe(role);
  });

  it('seeds an administrator, so master data can be maintained in a demo', () => {
    expect(DEMO_USERS.filter((user) => user.role === 'ADMINISTRATOR')).toHaveLength(1);
  });

  it('no longer seeds the retired demo accounts', () => {
    const emails = DEMO_USERS.map((user) => user.email);

    expect(emails).not.toContain('admin@erp.local');
    expect(emails).not.toContain('staff@erp.local');
  });

  it('gives every account a distinct email', () => {
    const emails = DEMO_USERS.map((user) => user.email);

    expect(new Set(emails).size).toBe(emails.length);
  });
});
