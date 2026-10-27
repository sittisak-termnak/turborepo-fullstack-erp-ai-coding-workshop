import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { APP_ERRORS, type User } from '@erp/contracts';
import { hashPassword } from '@erp/database';
import { call, type ORPCError } from '@orpc/server';
import type { Response } from 'express';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { SESSION_COOKIE, verifySessionToken } from './session-token.js';

const secret = 'test-secret-that-is-at-least-32-characters';
const admin: User = {
  id: 'u1',
  email: 'admin01@erp.local',
  name: 'Admin One',
  role: 'ADMINISTRATOR',
  storeId: null,
};
const staff: User = {
  id: 'u2',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-b01',
};

async function createController(findUnique = vi.fn()) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: PrismaService, useValue: { user: { findUnique } } },
      {
        provide: ConfigService,
        useValue: { get: (key: string) => (key === 'AUTH_SECRET' ? secret : 'test') },
      },
    ],
  }).compile();
  return moduleRef.get(AuthController);
}

function fakeResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

describe('AuthController', () => {
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await hashPassword('password');
  });

  it('signs in and sets a signed session cookie', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue({ ...admin, passwordHash }),
    );
    const res = fakeResponse();

    await expect(
      call(controller.login(res), { email: 'Admin01@erp.local', password: 'password' }),
    ).resolves.toEqual(admin);

    const [name, token, options] = res.cookie.mock.calls[0]!;
    expect(name).toBe(SESSION_COOKIE);
    expect(verifySessionToken(token, secret)).toBe('u1');
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax' });
  });

  it('rejects a wrong password without setting a cookie', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue({ ...admin, passwordHash }),
    );
    const res = fakeResponse();

    await expect(
      call(controller.login(res), { email: 'admin01@erp.local', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  // NFR-04: Thai, actionable, and free of stack traces or database detail.
  it('tells a rejected sign-in to correct its input, in Thai, leaking nothing internal', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue({ ...admin, passwordHash }),
    );

    const error = await call(controller.login(fakeResponse()), {
      email: 'admin01@erp.local',
      password: 'wrong',
    }).then(
      () => undefined,
      (thrown: unknown) => thrown as ORPCError<string, unknown>,
    );

    expect(error?.message).toBe(APP_ERRORS.INVALID_CREDENTIALS.message);
    expect(error?.data).toMatchObject({ action: 'CORRECT_INPUT' });
    // The message is the only thing the client sees, so it must carry no implementation detail.
    expect(error?.message).not.toMatch(/[A-Za-z]/);
    expect(JSON.stringify(error?.data)).not.toMatch(/prisma|select|postgres|passwordHash|at /i);
  });

  it('rejects an unknown email', async () => {
    const controller = await createController(vi.fn().mockResolvedValue(null));

    await expect(
      call(controller.login(fakeResponse()), { email: 'nobody@erp.local', password: 'password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
  });

  it('clears the cookie on logout', async () => {
    const controller = await createController();
    const res = fakeResponse();

    await call(controller.logout(res), undefined);

    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(Object));
  });

  it('returns the current user, or null when signed out', async () => {
    const controller = await createController();

    await expect(call(controller.me(admin), undefined)).resolves.toEqual({ user: admin });
    await expect(call(controller.me(undefined), undefined)).resolves.toEqual({ user: null });
  });

  it('reports the store assignment of a signed-in store employee', async () => {
    const controller = await createController();

    await expect(call(controller.me(staff), undefined)).resolves.toEqual({
      user: { ...staff, storeId: 'store-b01' },
    });
  });

  it('reports a null store assignment for a cross-store role', async () => {
    const controller = await createController();

    await expect(call(controller.me(admin), undefined)).resolves.toMatchObject({
      user: { storeId: null },
    });
  });

  // call() runs the contract's output validation, so a role the contract rejects fails here.
  it.each(['ADMINISTRATOR', 'PURCHASING_OFFICER', 'STORE_EMPLOYEE', 'MANAGER'] as const)(
    'returns a signed-in %s',
    async (role) => {
      const controller = await createController();

      await expect(call(controller.me({ ...admin, role }), undefined)).resolves.toEqual({
        user: { ...admin, role },
      });
    },
  );
});
