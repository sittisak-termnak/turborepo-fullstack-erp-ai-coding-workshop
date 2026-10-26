import { createPrismaClient, DEMO_PASSWORD, DEMO_USERS, hashPassword } from '../src/index.js';

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
  await prisma.user.deleteMany({ where: { email: { in: RETIRED_DEMO_EMAILS } } });
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: { ...user, passwordHash },
    });
  }
  console.log(`Seeded ${DEMO_USERS.length} demo users (password: "${DEMO_PASSWORD}").`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
