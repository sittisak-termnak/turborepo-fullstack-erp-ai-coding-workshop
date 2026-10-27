import { describe, expect, it } from 'vitest';
import { isPrismaCode } from './prisma-error.js';

describe('isPrismaCode', () => {
  it('matches an error carrying the given Prisma code', () => {
    expect(isPrismaCode({ code: 'P2002' }, 'P2002')).toBe(true);
  });

  it('does not match a different code', () => {
    expect(isPrismaCode({ code: 'P2025' }, 'P2002')).toBe(false);
  });

  it('does not match a plain error with no code', () => {
    expect(isPrismaCode(new Error('boom'), 'P2002')).toBe(false);
  });

  it('does not match a non-object value', () => {
    expect(isPrismaCode('not an error', 'P2002')).toBe(false);
    expect(isPrismaCode(null, 'P2002')).toBe(false);
    expect(isPrismaCode(undefined, 'P2002')).toBe(false);
  });
});
