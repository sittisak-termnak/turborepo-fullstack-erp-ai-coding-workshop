import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/errors';

/**
 * The four states a list screen can be in: loading, error, empty, populated (AC-04, AC-05).
 *
 * #5 is the first list in the product, and the ticket asks it to land the primitives every later
 * list reuses. This is that primitive, so a screen never decides for itself what "no rows" looks
 * like and no list ships a blank panel.
 *
 * Wrap the rows; pass the query's own `isPending` and `error` straight through.
 */
export function ListState({
  isPending,
  error,
  isEmpty,
  emptyMessage = 'ไม่พบข้อมูล',
  children,
}: {
  isPending: boolean;
  error: unknown;
  isEmpty: boolean;
  /** What to say when the filter matched nothing. Name it per screen; keep it Thai. */
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (isPending) {
    return (
      <p role="status" className="py-8 text-center text-sm text-muted-foreground">
        กำลังโหลดข้อมูล…
      </p>
    );
  }

  // A failed query has no rows either, so the error has to win: otherwise a server fault would
  // read to the user as "there is nothing here".
  if (error) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-destructive">
        {errorMessage(error)}
      </p>
    );
  }

  if (isEmpty) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return <>{children}</>;
}
