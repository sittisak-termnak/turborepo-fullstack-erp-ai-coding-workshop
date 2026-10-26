import { APP_ERRORS, type AppErrorCode } from '@erp/contracts';
import { ORPCError } from '@orpc/nest';

/**
 * The only way a handler should reject a request: the Thai message and the correct-input-or-retry
 * action both come from the shared catalogue in `@erp/contracts`, so NFR-04's format is decided
 * once instead of per route, and no handler can accidentally return an English or leaky message.
 */
export function appError(status: 'UNAUTHORIZED' | 'FORBIDDEN' | 'BAD_REQUEST', code: AppErrorCode) {
  const { message, action } = APP_ERRORS[code];
  return new ORPCError(status, { message, data: { code, action } });
}
