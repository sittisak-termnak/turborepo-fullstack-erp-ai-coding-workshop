import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RoleSchema, SessionSchema, UserSchema } from './auth.js';

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

describe('UserSchema', () => {
  const base = { id: '1', email: 'a@erp.local', name: 'A', role: 'STORE_EMPLOYEE' } as const;

  it('carries a store assignment for a store employee', () => {
    const result = UserSchema.safeParse({ ...base, storeId: 'store-b01' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.storeId).toBe('store-b01');
  });

  it('accepts a null store assignment for a cross-store role', () => {
    const result = UserSchema.safeParse({ ...base, role: 'MANAGER', storeId: null });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.storeId).toBeNull();
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
