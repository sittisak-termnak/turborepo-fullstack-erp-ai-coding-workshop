import { Controller } from '@nestjs/common';
import { APP_ERRORS, contract, type Product } from '@erp/contracts';
import { Implement, implement } from '@orpc/nest';
import { Roles } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';

/** A row as Prisma returns it: `sellingPrice` is a Decimal, `createdAt` is an ordering key. */
type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  sellingPrice: unknown;
  active: boolean;
};

/** The product as the contract publishes it. Decimal becomes a plain number; the ordering key is dropped. */
function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    sellingPrice: typeof row.sellingPrice === 'number' ? row.sellingPrice : Number(row.sellingPrice),
    active: row.active,
  };
}

/**
 * Prisma signals a constraint breach with a code on the error, not a distinct class we can
 * `instanceof` across the ESM boundary. P2002 is a unique violation, P2025 a missing row.
 */
function isPrismaCode(error: unknown, code: 'P2002' | 'P2025'): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

@Controller()
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  // Product maintenance is the Administrator's screen (MD-01), mirroring stores.controller.ts:
  // no row-level rule applies, because maintaining the catalogue is cross-store by definition.
  @Roles('ADMINISTRATOR')
  @Implement(contract.products.list)
  list() {
    return implement(contract.products.list).handler(async ({ input }) => {
      const where = {
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.q
          ? {
              OR: [
                { sku: { contains: input.q, mode: 'insensitive' as const } },
                { name: { contains: input.q, mode: 'insensitive' as const } },
                { category: { contains: input.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.product.count({ where }),
      ]);

      return { items: rows.map(toProduct), total };
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.products.create)
  create() {
    return implement(contract.products.create).handler(async ({ input, errors }) => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              sku: input.sku,
              name: input.name,
              category: input.category,
              unit: input.unit,
              sellingPrice: input.sellingPrice,
              active: input.active,
            },
          });

          // Eager creation (the ticket's own rule): a product-store row for every existing
          // store, so a product that has never moved still has one, as the low-stock report
          // needs. Lazy creation on first movement would leave a zero-stock row missing.
          const stores = await tx.store.findMany({ select: { id: true } });
          if (stores.length > 0) {
            await tx.productStore.createMany({
              data: stores.map((store) => ({ productId: product.id, storeId: store.id })),
            });
          }

          return toProduct(product);
        });
      } catch (error) {
        // Let the database decide uniqueness rather than checking first: a read-then-write would
        // let two concurrent creates past the check and still breach the constraint.
        if (isPrismaCode(error, 'P2002')) {
          throw errors.PRODUCT_SKU_TAKEN({ data: { action: APP_ERRORS.PRODUCT_SKU_TAKEN.action } });
        }
        throw error;
      }
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.products.update)
  update() {
    return implement(contract.products.update).handler(async ({ input, errors }) => {
      try {
        return toProduct(
          await this.prisma.product.update({
            where: { id: input.id },
            data: {
              sku: input.sku,
              name: input.name,
              category: input.category,
              unit: input.unit,
              sellingPrice: input.sellingPrice,
              active: input.active,
            },
          }),
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2002')) {
          throw errors.PRODUCT_SKU_TAKEN({ data: { action: APP_ERRORS.PRODUCT_SKU_TAKEN.action } });
        }
        if (isPrismaCode(error, 'P2025')) {
          throw errors.PRODUCT_NOT_FOUND({ data: { action: APP_ERRORS.PRODUCT_NOT_FOUND.action } });
        }
        throw error;
      }
    });
  }
}
