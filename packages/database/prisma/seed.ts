import {
  createPrismaClient,
  DEMO_PASSWORD,
  DEMO_PRODUCTS,
  DEMO_REORDER_THRESHOLD,
  DEMO_STORES,
  DEMO_SUPPLIERS,
  DEMO_USERS,
  hashPassword,
} from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

/**
 * The starter accounts, superseded by the TOR section 8.1 users. The four-roles migration maps
 * their role rather than deleting the rows, so a clone that already ran the old seed keeps them
 * until this removes them.
 */
const RETIRED_DEMO_EMAILS = ['admin@erp.local', 'staff@erp.local'];

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Stores first: a store employee's assignment resolves a store code to its id.
  const storeIdByCode = new Map<string, string>();
  for (const store of DEMO_STORES) {
    const row = await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: store,
    });
    storeIdByCode.set(store.code, row.id);
  }

  // #6's §8.1 supplier. phone/address stay null: §8.1 gives no contact values to seed with.
  for (const supplier of DEMO_SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: { name: supplier.name, phone: supplier.phone, address: supplier.address },
      create: supplier,
    });
  }

  await prisma.user.deleteMany({ where: { email: { in: RETIRED_DEMO_EMAILS } } });
  for (const user of DEMO_USERS) {
    const storeId = 'storeCode' in user ? (storeIdByCode.get(user.storeCode) ?? null) : null;
    const { email, name, role } = user;
    await prisma.user.upsert({
      where: { email },
      update: { name, role, passwordHash, storeId },
      create: { email, name, role, passwordHash, storeId },
    });
  }

  // Products, then one product-store row per store (MD-01's eager creation), carrying the
  // §8.1 opening balances at B01 and zero everywhere else.
  for (const { b01Balance, ...product } of DEMO_PRODUCTS) {
    const row = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        category: product.category,
        unit: product.unit,
        sellingPrice: product.sellingPrice,
      },
      create: product,
    });

    for (const store of DEMO_STORES) {
      const storeId = storeIdByCode.get(store.code);
      if (!storeId) continue;
      const balance = store.code === 'B01' ? b01Balance : 0;
      await prisma.productStore.upsert({
        where: { productId_storeId: { productId: row.id, storeId } },
        update: { balance, reorderThreshold: DEMO_REORDER_THRESHOLD },
        create: { productId: row.id, storeId, balance, reorderThreshold: DEMO_REORDER_THRESHOLD },
      });
    }
  }

  console.log(
    `Seeded ${DEMO_STORES.length} stores, ${DEMO_SUPPLIERS.length} suppliers, ${DEMO_PRODUCTS.length} products and ${DEMO_USERS.length} demo users (password: "${DEMO_PASSWORD}").`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
