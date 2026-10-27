import { Controller } from '@nestjs/common';
import { contract, type User } from '@erp/contracts';
import { Implement, implement, ORPCError } from '@orpc/nest';
import { CurrentUser } from '../auth/auth.decorators.js';
import { assertStoreAccess } from '../auth/store-scope.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller()
export class StoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Implement(contract.stores.read)
  read(@CurrentUser() user: User) {
    return implement(contract.stores.read).handler(async ({ input }) => {
      const store = await this.prisma.store.findUnique({ where: { code: input.code } });
      if (!store) {
        throw new ORPCError('NOT_FOUND', { message: `No store with code ${input.code}` });
      }

      // NFR-01: the guard authenticated the user; the row-level rule is enforced here, now that
      // the target store is loaded. assertStoreAccess records the outcome and throws on refusal.
      await assertStoreAccess(this.prisma, user, {
        action: 'stores.read',
        target: store.code,
        targetStoreId: store.id,
      });

      return { id: store.id, code: store.code, name: store.name };
    });
  }
}
