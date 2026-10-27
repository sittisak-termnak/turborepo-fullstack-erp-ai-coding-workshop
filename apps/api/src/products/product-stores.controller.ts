import { Controller } from '@nestjs/common';
import { APP_ERRORS, contract, type ProductStore } from '@erp/contracts';
import { Implement, implement } from '@orpc/nest';
import { Roles } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';

type ProductStoreRow = {
  productId: string;
  storeId: string;
  balance: number;
  reorderThreshold: number;
  store: { code: string; name: string };
};

/** The product-store row as the contract publishes it: the store's business fields inlined. */
function toProductStore(row: ProductStoreRow): ProductStore {
  return {
    productId: row.productId,
    storeId: row.storeId,
    storeCode: row.store.code,
    storeName: row.store.name,
    balance: row.balance,
    reorderThreshold: row.reorderThreshold,
  };
}

function isPrismaCode(error: unknown, code: 'P2025'): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * The reorder threshold per store (MD-01). No "create" route here: every row this controller
 * touches was already created eagerly, by ProductsController.create or StoresController.create.
 */
@Controller()
export class ProductStoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('ADMINISTRATOR')
  @Implement(contract.productStores.listForProduct)
  listForProduct() {
    return implement(contract.productStores.listForProduct).handler(async ({ input }) => {
      const rows = await this.prisma.productStore.findMany({
        where: { productId: input.productId },
        include: { store: true },
        orderBy: { store: { code: 'asc' } },
      });
      return rows.map(toProductStore);
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.productStores.updateThreshold)
  updateThreshold() {
    return implement(contract.productStores.updateThreshold).handler(async ({ input, errors }) => {
      try {
        const row = await this.prisma.productStore.update({
          where: { productId_storeId: { productId: input.productId, storeId: input.storeId } },
          data: { reorderThreshold: input.reorderThreshold },
          include: { store: true },
        });
        return toProductStore(row);
      } catch (error) {
        if (isPrismaCode(error, 'P2025')) {
          throw errors.PRODUCT_STORE_NOT_FOUND({
            data: { action: APP_ERRORS.PRODUCT_STORE_NOT_FOUND.action },
          });
        }
        throw error;
      }
    });
  }
}
