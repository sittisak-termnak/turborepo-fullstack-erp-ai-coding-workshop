import { Test } from '@nestjs/testing';
import { call } from '@orpc/server';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { ProductStoresController } from './product-stores.controller.js';

const b01Row = {
  productId: 'product-water',
  storeId: 'store-b01',
  balance: 10,
  reorderThreshold: 3,
  store: { id: 'store-b01', code: 'B01', name: 'Branch 01' },
};
const b02Row = {
  productId: 'product-water',
  storeId: 'store-b02',
  balance: 0,
  reorderThreshold: 3,
  store: { id: 'store-b02', code: 'B02', name: 'Branch 02' },
};

class RecordNotFound extends Error {
  readonly code = 'P2025';
}

function stubPrisma(rows = [b01Row, b02Row]) {
  return {
    productStore: {
      findMany: vi.fn(async ({ where }: { where: { productId: string } }) =>
        rows.filter((row) => row.productId === where.productId),
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { productId_storeId: { productId: string; storeId: string } };
          data: { reorderThreshold: number };
        }) => {
          const row = rows.find(
            (candidate) =>
              candidate.productId === where.productId_storeId.productId &&
              candidate.storeId === where.productId_storeId.storeId,
          );
          if (!row) throw new RecordNotFound();
          Object.assign(row, data);
          return row;
        },
      ),
    },
  };
}

async function createController(prisma: ReturnType<typeof stubPrisma>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProductStoresController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(ProductStoresController);
}

describe('ProductStoresController.listForProduct', () => {
  it("lists every store with the product's balance and threshold at each", async () => {
    const controller = await createController(stubPrisma());

    const rows = await call(controller.listForProduct(), { productId: 'product-water' });

    expect(rows).toEqual([
      {
        productId: 'product-water',
        storeId: 'store-b01',
        storeCode: 'B01',
        storeName: 'Branch 01',
        balance: 10,
        reorderThreshold: 3,
      },
      {
        productId: 'product-water',
        storeId: 'store-b02',
        storeCode: 'B02',
        storeName: 'Branch 02',
        balance: 0,
        reorderThreshold: 3,
      },
    ]);
  });
});

describe('ProductStoresController.updateThreshold', () => {
  // The Demo line: give B01 and B02 different thresholds, each independent of the other.
  it('sets the threshold for one store without touching the other', async () => {
    const prisma = stubPrisma();
    const controller = await createController(prisma);

    const updated = await call(controller.updateThreshold(), {
      productId: 'product-water',
      storeId: 'store-b01',
      reorderThreshold: 5,
    });

    expect(updated.reorderThreshold).toBe(5);
    const untouched = await call(controller.listForProduct(), { productId: 'product-water' });
    expect(untouched.find((row) => row.storeId === 'store-b02')?.reorderThreshold).toBe(3);
  });

  it('reports a product-store pairing that does not exist with the declared error', async () => {
    const controller = await createController(stubPrisma());

    await expect(
      call(controller.updateThreshold(), {
        productId: 'product-gone',
        storeId: 'store-b01',
        reorderThreshold: 5,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_STORE_NOT_FOUND' });
  });
});
