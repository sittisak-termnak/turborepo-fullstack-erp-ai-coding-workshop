import { Logger } from '@nestjs/common';
import { APP_ERRORS } from '@erp/contracts';
import { ORPCError } from '@orpc/nest';
import { describe, expect, it, vi } from 'vitest';
import { publicErrorInterceptor } from './app-error.js';

/** Runs the interceptor over a `next` that resolves or rejects, and reports what came back out. */
function intercept(next: () => Promise<unknown>) {
  return publicErrorInterceptor({ next });
}

describe('publicErrorInterceptor', () => {
  it('leaves a successful call alone', async () => {
    await expect(intercept(async () => ({ api: 'ok' }))).resolves.toEqual({ api: 'ok' });
  });

  it('passes an error the contract declared through untouched', async () => {
    const declared = new ORPCError('INVALID_CREDENTIALS', {
      status: 401,
      message: APP_ERRORS.INVALID_CREDENTIALS.message,
      data: { action: APP_ERRORS.INVALID_CREDENTIALS.action },
    });

    await expect(intercept(() => Promise.reject(declared))).rejects.toBe(declared);
  });

  // NFR-04: an unexpected failure must not disclose a stack trace or database detail.
  it('replaces an unexpected failure with a Thai retry message and no internal detail', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const leaky = new Error('relation "User" does not exist — prisma.user.findUnique failed');

    const thrown: ORPCError<string, unknown> = await intercept(() => Promise.reject(leaky)).then(
      () => {
        throw new Error('expected the interceptor to reject');
      },
      (error: ORPCError<string, unknown>) => error,
    );

    expect(thrown.status).toBe(500);
    expect(thrown.message).toBe(APP_ERRORS.UNEXPECTED.message);
    expect(thrown.data).toEqual({ action: 'RETRY' });
    expect(thrown.message).not.toMatch(/[A-Za-z]/);
    expect(JSON.stringify({ message: thrown.message, data: thrown.data })).not.toMatch(
      /prisma|relation|does not exist/i,
    );
  });
});
