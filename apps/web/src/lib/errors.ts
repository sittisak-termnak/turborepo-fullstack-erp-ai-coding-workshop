import { APP_ERRORS } from '@erp/contracts';
import { ORPCError } from '@orpc/client';

/**
 * What to show the user when a request failed.
 *
 * Anything the API answered already carries the actionable Thai message from the shared catalogue
 * (see `appError` in apps/api), and it is more specific than anything this side could say, so it
 * is displayed as-is. Only a request that never reached the API needs a message from here.
 */
export function errorMessage(error: unknown): string {
  return error instanceof ORPCError ? error.message : APP_ERRORS.UNREACHABLE.message;
}
