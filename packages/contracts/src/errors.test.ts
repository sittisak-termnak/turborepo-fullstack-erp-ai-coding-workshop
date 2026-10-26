import { describe, expect, it } from 'vitest';
import { APP_ERRORS } from './errors.js';

describe('APP_ERRORS', () => {
  it('tells a user with wrong credentials to correct their input, in Thai', () => {
    const error = APP_ERRORS.INVALID_CREDENTIALS;

    expect(error.action).toBe('CORRECT_INPUT');
    expect(error.message).toMatch(/[\u0E00-\u0E7F]/);
  });

  it('tells a user hitting an unexpected failure to retry, in Thai', () => {
    const error = APP_ERRORS.UNEXPECTED;

    expect(error.action).toBe('RETRY');
    expect(error.message).toMatch(/[\u0E00-\u0E7F]/);
  });

  // NFR-04: no message may carry implementation detail, which in practice means no Latin script.
  it('writes every message in Thai only', () => {
    for (const [code, { message }] of Object.entries(APP_ERRORS)) {
      expect(message, code).not.toMatch(/[A-Za-z]/);
    }
  });
});
