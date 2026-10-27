import { describe, expect, it } from 'vitest';
import { LoginInputSchema, ROLE_LABELS, RoleSchema, SessionSchema } from './auth.js';

describe('RoleSchema', () => {
  // The four roles of TOR section 2. They are deliberately not nested: an Administrator
  // does not automatically receive the transaction approval rights of a Manager.
  it.each(['ADMINISTRATOR', 'PURCHASING_OFFICER', 'STORE_EMPLOYEE', 'MANAGER'])(
    'accepts %s',
    (role) => {
      expect(RoleSchema.safeParse(role).success).toBe(true);
    },
  );

  it.each(['ADMIN', 'STAFF'])('rejects the retired role %s', (role) => {
    expect(RoleSchema.safeParse(role).success).toBe(false);
  });

  it('offers exactly the four roles and nothing else', () => {
    expect([...RoleSchema.options].sort()).toEqual([
      'ADMINISTRATOR',
      'MANAGER',
      'PURCHASING_OFFICER',
      'STORE_EMPLOYEE',
    ]);
  });
});

describe('LoginInputSchema', () => {
  it('accepts an email and password', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin@erp.local', password: 'password' });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin', password: 'password' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin@erp.local', password: '' });

    expect(result.success).toBe(false);
  });
});

describe('SessionSchema', () => {
  it('accepts a signed-out session', () => {
    expect(SessionSchema.safeParse({ user: null }).success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const result = SessionSchema.safeParse({
      user: { id: '1', email: 'a@erp.local', name: 'A', role: 'OWNER' },
    });

    expect(result.success).toBe(false);
  });
});

describe('ROLE_LABELS', () => {
  it('gives every role a Thai label', () => {
    for (const role of RoleSchema.options) {
      expect(ROLE_LABELS[role], role).toMatch(/[\u0E00-\u0E7F]/);
      expect(ROLE_LABELS[role], role).not.toMatch(/[A-Za-z]/);
    }
  });
});
