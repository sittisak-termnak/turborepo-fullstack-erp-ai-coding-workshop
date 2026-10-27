import { Logger } from '@nestjs/common';
import { APP_ERRORS, type AppErrorData } from '@erp/contracts';
import { ORPCError } from '@orpc/nest';

const logger = new Logger('AppError');

/**
 * Registered globally on `ORPCModule.forRoot`. Handlers reject with the errors their contract route
 * declares; anything else they throw — a Prisma failure, a programming mistake — would otherwise
 * reach the client as a stack trace or a database detail, which NFR-04 forbids. Here it becomes
 * the catalogue's Thai retry message instead. The original is logged server-side and attached as
 * `cause`, which oRPC does not serialise.
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
      data: { action } satisfies AppErrorData,
      cause: thrown,
    });
  });
}
