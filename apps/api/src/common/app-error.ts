import { Logger } from '@nestjs/common';
import { APP_ERRORS, type AppErrorCode } from '@erp/contracts';
import { ORPCError } from '@orpc/nest';

/**
 * The only way a handler should reject a request: the Thai message and the correct-input-or-retry
 * action both come from the shared catalogue in `@erp/contracts`, so NFR-04's format is decided
 * once instead of per route, and no handler can accidentally return an English or leaky message.
 */
export function appError(status: string, code: AppErrorCode) {
  const { message, action } = APP_ERRORS[code];
  return new ORPCError(status, { message, data: { code, action } });
}

const logger = new Logger('AppError');

/**
 * Registered globally on `ORPCModule.forRoot`. Anything a handler throws that isn't already a
 * catalogued error — a Prisma failure, a programming mistake — reaches the client as the
 * catalogue's retry message instead of a stack trace or a database detail, which NFR-04 forbids.
 * The original is logged server-side and attached as `cause`, which oRPC does not serialise.
 */
export function publicErrorInterceptor({
  next,
}: {
  next: () => Promise<unknown>;
}): Promise<unknown> {
  return next().catch((thrown: unknown) => {
    if (thrown instanceof ORPCError) throw thrown;

    logger.error('Unhandled error in an oRPC handler', thrown);
    const { message, action } = APP_ERRORS.UNEXPECTED;
    throw new ORPCError('INTERNAL_SERVER_ERROR', {
      message,
      data: { code: 'UNEXPECTED', action },
      cause: thrown,
    });
  });
}
