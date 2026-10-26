import { describe, expect, it } from 'vitest';
import { APP_ERRORS } from './errors.js';

describe('APP_ERRORS', () => {
  it('tells a user with wrong credentials to correct their input, in Thai', () => {
    const error = APP_ERRORS.INVALID_CREDENTIALS;

    expect(error.action).toBe('CORRECT_INPUT');
    expect(error.message).toMatch(/[\u0E00-\u0E7F]/);
  });
});
