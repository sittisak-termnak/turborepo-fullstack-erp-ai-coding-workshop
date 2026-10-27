import { Controller } from '@nestjs/common';
import { APP_ERRORS, contract, type Store, type User } from '@erp/contracts';
import { Implement, implement, ORPCError } from '@orpc/nest';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { assertStoreAccess } from '../auth/store-scope.js';
import { isPrismaCode } from '../common/prisma-error.js';
import { PrismaService } from '../database/prisma.service.js';

/** The store as the contract publishes it. Drops `createdAt`, which is an ordering key, not data. */
const toStore = (row: Store): Store => ({ id: row.id, code: row.code, name: row.name });

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

  // Store maintenance is the Administrator's screen (MD-03), so the coarse gate is declarative and
  // the guard refuses every other role before the handler runs. No row-level rule applies here:
  // maintaining the list of stores is cross-store by definition, so there is no target to scope to.
  @Roles('ADMINISTRATOR')
  @Implement(contract.stores.list)
  list() {
    return implement(contract.stores.list).handler(async ({ input }) => {
      const where = input.q
        ? {
            OR: [
              { code: { contains: input.q, mode: 'insensitive' as const } },
              { name: { contains: input.q, mode: 'insensitive' as const } },
            ],
          }
        : undefined;

      // The count is of everything the filter matched, not of this page: §6.2's reports need it
      // and the screen needs it to know whether another page exists.
      const [rows, total] = await Promise.all([
        this.prisma.store.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.store.count({ where }),
      ]);

      return { items: rows.map(toStore), total };
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.stores.create)
  create() {
    return implement(contract.stores.create).handler(async ({ input, errors }) => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const store = await tx.store.create({ data: { code: input.code, name: input.name } });

          // #7's eager-creation rule, the mirror image of ProductsController.create: a new
          // product-store row for every existing product, so a brand-new store is never missing
          // a row the low-stock report needs.
          const products = await tx.product.findMany({ select: { id: true } });
          if (products.length > 0) {
            await tx.productStore.createMany({
              data: products.map((product) => ({ productId: product.id, storeId: store.id })),
            });
          }

          return toStore(store);
        });
      } catch (error) {
        // Let the database decide uniqueness rather than checking first: a read-then-write would
        // let two concurrent creates past the check and still breach the constraint.
        if (isPrismaCode(error, 'P2002')) {
          throw errors.STORE_CODE_TAKEN({ data: { action: APP_ERRORS.STORE_CODE_TAKEN.action } });
        }
        throw error;
      }
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.stores.update)
  update() {
    return implement(contract.stores.update).handler(async ({ input, errors }) => {
      try {
        return toStore(
          await this.prisma.store.update({
            where: { id: input.id },
            data: { code: input.code, name: input.name },
          }),
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2002')) {
          throw errors.STORE_CODE_TAKEN({ data: { action: APP_ERRORS.STORE_CODE_TAKEN.action } });
        }
        if (isPrismaCode(error, 'P2025')) {
          throw errors.STORE_NOT_FOUND({ data: { action: APP_ERRORS.STORE_NOT_FOUND.action } });
        }
        throw error;
      }
    });
  }
}
