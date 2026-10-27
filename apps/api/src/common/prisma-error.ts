/**
 * Prisma signals a constraint breach with a code on the error, not a distinct class we can
 * `instanceof` across the ESM boundary. P2002 is a unique violation, P2025 a missing row.
 *
 * Shared by every controller that lets the database decide a uniqueness or existence rule
 * rather than checking first (stores, products, product-stores): a read-then-write would let two
 * concurrent writes past the check and still breach the constraint.
 */
export function isPrismaCode(error: unknown, code: 'P2002' | 'P2025'): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
