import { Button } from '@/components/ui/button';

/**
 * Offset paging over a total count, the second primitive #5 lands for every later list (the first
 * is `ListState`). It owns one decision only — which page exists next to this one — and hands the
 * page number back; where that number is kept (query string, state) is the screen's business.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  /** Everything the filter matched, not the length of this page. */
  total: number;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.ceil(total / pageSize);

  // One page, or none, is nothing to navigate. An empty result is the empty state's message.
  if (lastPage <= 1) return null;

  return (
    <nav className="flex items-center gap-4" aria-label="การแบ่งหน้า">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        หน้าก่อนหน้า
      </Button>
      <span className="text-sm text-muted-foreground">
        หน้า {page} จาก {lastPage}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      >
        หน้าถัดไป
      </Button>
    </nav>
  );
}
