import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    // Password hashing and Nest's module compiler each cost about a second, and `pnpm check` runs
    // lint, typecheck, test and build at once. The 5s default times out on a busy machine.
    testTimeout: 20_000,
    // The *.integration.spec.ts files share one real Postgres (see stores.integration.spec.ts
    // and products.integration.spec.ts) and now reach across the products/stores boundary --
    // creating a store touches every product's row and vice versa (#7's eager creation).
    // Running test files in parallel let one file's cleanup delete rows mid-transaction in
    // another, an intermittent failure with nothing wrong in the code. Both the stub-based specs
    // and the DB-backed ones run in one process either way, just one file after another.
    fileParallelism: false,
  },
});
