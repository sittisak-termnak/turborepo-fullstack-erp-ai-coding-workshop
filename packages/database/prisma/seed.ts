import {
  createPrismaClient,
  DEMO_PASSWORD,
  DEMO_STORES,
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

  console.log(
    `Seeded ${DEMO_STORES.length} stores and ${DEMO_USERS.length} demo users (password: "${DEMO_PASSWORD}").`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
