import { Controller } from '@nestjs/common';
import { contract, type StockItem, type User } from '@erp/contracts';
import { Implement, implement } from '@orpc/nest';
import { CurrentUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';

type StockRow = {
  productId: string;
  storeId: string;
  balance: number;
  reorderThreshold: number;
  product: { sku: string; name: string; unit: string };
  store: { code: string; name: string };
};

/** The row as the contract publishes it. `lowStock` has exactly one definition, computed here. */
function toStockItem(row: StockRow): StockItem {
  return {
    productId: row.productId,
    sku: row.product.sku,
    productName: row.product.name,
    unit: row.product.unit,
    storeId: row.storeId,
    storeCode: row.store.code,
    storeName: row.store.name,
    balance: row.balance,
    reorderThreshold: row.reorderThreshold,
    lowStock: row.balance <= row.reorderThreshold,
  };
}

@Controller()
export class StockController {
  constructor(private readonly prisma: PrismaService) {}

  // INV-01. Open to every signed-in role, like stores.read: a Store employee views stock for
  // their own store and a Manager views it across all of them, and nothing in the TOR excludes
  // the other two roles from a read-only search.
  @Implement(contract.stock.list)
  list(@CurrentUser() user: User) {
    return implement(contract.stock.list).handler(async ({ input }) => {
      // NFR-01: the row-level rule is enforced here, not left to the UI to hide a filter field.
      // A Store employee's search is forced to their own store regardless of any `store` text
      // they send; `''` for a storeless employee matches no row rather than every row.
      const storeId = user.role === 'STORE_EMPLOYEE' ? (user.storeId ?? '') : undefined;

      const where = {
        ...(storeId !== undefined ? { storeId } : {}),
        ...(input.store
          ? {
              store: {
                OR: [
                  { code: { contains: input.store, mode: 'insensitive' as const } },
                  { name: { contains: input.store, mode: 'insensitive' as const } },
                ],
              },
            }
          : {}),
        ...(input.q
          ? {
              product: {
                OR: [
                  { sku: { contains: input.q, mode: 'insensitive' as const } },
                  { name: { contains: input.q, mode: 'insensitive' as const } },
                ],
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        this.prisma.productStore.findMany({
          where,
          include: { product: true, store: true },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.productStore.count({ where }),
      ]);

      return { items: rows.map(toStockItem), total };
    });
  }
}
