import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { STOCK_PAGE_SIZE_DEFAULT } from '@erp/contracts';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { ListState } from '@/components/list-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/lib/auth';
import { orpc } from '@/lib/orpc';

/** A positive integer from the query string, or the fallback when it is missing or nonsense. */
function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Stock search (INV-01). A Store employee's search is forced to their own store at the API
 * (NFR-01); the store filter below is offered only to the cross-store roles it could possibly
 * narrow anything for, which is a convenience, not the enforcement.
 */
export function StockPage() {
  const user = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = positiveInt(searchParams.get('pageSize'), STOCK_PAGE_SIZE_DEFAULT);
  const q = searchParams.get('q') ?? '';
  const store = searchParams.get('store') ?? '';
  const canFilterByStore = user?.role !== 'STORE_EMPLOYEE';

  const stock = useQuery(
    orpc.stock.list.queryOptions({
      input: {
        page,
        pageSize,
        ...(q ? { q } : {}),
        ...(canFilterByStore && store ? { store } : {}),
      },
    }),
  );

  const [filter, setFilter] = useState(q);
  const [storeFilter, setStoreFilter] = useState(store);

  const total = stock.data?.total;

  const goTo = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    setSearchParams(params);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">ค้นหาคลังสินค้า</h1>

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          // A new search starts from the first page; staying on page 7 would look empty.
          goTo({
            q: filter.trim(),
            ...(canFilterByStore ? { store: storeFilter.trim() } : {}),
            page: undefined,
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="stock-filter">ค้นหาสินค้า</Label>
          <Input
            id="stock-filter"
            placeholder="รหัสสินค้าหรือชื่อสินค้า"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        {canFilterByStore && (
          <div className="space-y-2">
            <Label htmlFor="stock-store-filter">ค้นหาตามสาขา</Label>
            <Input
              id="stock-store-filter"
              placeholder="รหัสสาขาหรือชื่อสาขา"
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
            />
          </div>
        )}
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
      </form>

      {total !== undefined && (
        <p className="text-sm text-muted-foreground">ทั้งหมด {total} รายการ</p>
      )}

      <ListState
        isPending={stock.isPending}
        error={stock.error}
        isEmpty={stock.data?.items.length === 0}
        emptyMessage="ไม่พบสินค้าที่ตรงกับเงื่อนไข"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">รายการคงเหลือของสินค้า เรียงจากที่เพิ่มล่าสุด</caption>
          <thead className="border-b">
            <tr>
              <th scope="col" className="py-2">
                รหัสสินค้า
              </th>
              <th scope="col" className="py-2">
                ชื่อสินค้า
              </th>
              <th scope="col" className="py-2">
                สาขา
              </th>
              <th scope="col" className="py-2">
                หน่วย
              </th>
              <th scope="col" className="py-2">
                ยอดคงเหลือ
              </th>
              <th scope="col" className="py-2">
                เกณฑ์สั่งซื้อซ้ำ
              </th>
              <th scope="col" className="py-2">
                สถานะ
              </th>
            </tr>
          </thead>
          <tbody>
            {stock.data?.items.map((item) => (
              <tr key={`${item.productId}-${item.storeId}`} className="border-b last:border-0">
                <td className="py-2 font-medium">{item.sku}</td>
                <td className="py-2">{item.productName}</td>
                <td className="py-2">
                  {item.storeCode} ({item.storeName})
                </td>
                <td className="py-2">{item.unit}</td>
                <td className="py-2">{item.balance}</td>
                <td className="py-2">{item.reorderThreshold}</td>
                <td className="py-2">
                  {item.lowStock && <Badge variant="destructive">สต็อกต่ำ</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListState>

      {total !== undefined && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(next) => goTo({ page: String(next) })}
        />
      )}
    </div>
  );
}
