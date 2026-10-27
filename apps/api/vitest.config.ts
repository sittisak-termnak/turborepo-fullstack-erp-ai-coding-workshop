import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    // Password hashing and Nest's module compiler each cost about a second, and `pnpm check` runs
    // lint, typecheck, test and build at once. The 5s default times out on a busy machine.
    testTimeout: 20_000,
  },
});
