import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { STORE_PAGE_SIZE_DEFAULT, type Store } from '@erp/contracts';
import { useSearchParams } from 'react-router';
import { ListState } from '@/components/list-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { orpc } from '@/lib/orpc';

/** A positive integer from the query string, or the fallback when it is missing or nonsense. */
function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Store maintenance (MD-03). The Administrator's screen: the API refuses every other role, which
 * is the enforcement; this screen is only the way in.
 *
 * The page, page size and filter live in the query string rather than in component state, so a
 * list view can be linked, bookmarked and reloaded on the same page the user was reading.
 */
export function StoresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = positiveInt(searchParams.get('pageSize'), STORE_PAGE_SIZE_DEFAULT);
  const q = searchParams.get('q') ?? '';

  const queryClient = useQueryClient();
  const stores = useQuery(
    orpc.stores.list.queryOptions({ input: { page, pageSize, ...(q ? { q } : {}) } }),
  );

  const [editing, setEditing] = useState<Store | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [filter, setFilter] = useState(q);

  const reset = () => {
    setEditing(null);
    setCode('');
    setName('');
  };
  // Every page of the list is stale after a write, so invalidate the whole list, not one page.
  const refreshList = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.stores.list.key() });
    reset();
  };

  const create = useMutation(orpc.stores.create.mutationOptions({ onSuccess: refreshList }));
  const update = useMutation(orpc.stores.update.mutationOptions({ onSuccess: refreshList }));
  const saving = editing ? update : create;

  const total = stores.data?.total;

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
      <h1 className="text-xl font-semibold">จัดการสาขา</h1>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? `แก้ไขสาขา ${editing.code}` : 'เพิ่มสาขาใหม่'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (editing) update.mutate({ id: editing.id, code, name });
              else create.mutate({ code, name });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="store-code">รหัสสาขา</Label>
              <Input
                id="store-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-name">ชื่อสาขา</Label>
              <Input
                id="store-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving.isPending}>
              {editing ? 'บันทึกการแก้ไข' : 'เพิ่มสาขา'}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={reset}>
                ยกเลิก
              </Button>
            )}
          </form>
          {saving.error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {errorMessage(saving.error)}
            </p>
          )}
        </CardContent>
      </Card>

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          // A new search starts from the first page; staying on page 7 would look empty.
          goTo({ q: filter.trim(), page: undefined });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="store-filter">ค้นหาสาขา</Label>
          <Input
            id="store-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
      </form>

      {total !== undefined && <p className="text-sm text-muted-foreground">ทั้งหมด {total} สาขา</p>}

      <ListState
        isPending={stores.isPending}
        error={stores.error}
        isEmpty={stores.data?.items.length === 0}
        emptyMessage={q ? `ไม่พบสาขาที่ตรงกับ “${q}”` : 'ไม่พบสาขา ยังไม่มีสาขาในระบบ'}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">รายการสาขาทั้งหมด เรียงจากที่เพิ่มล่าสุด</caption>
          <thead className="border-b">
            <tr>
              <th scope="col" className="py-2">
                รหัสสาขา
              </th>
              <th scope="col" className="py-2">
                ชื่อสาขา
              </th>
              <th scope="col" className="py-2 text-right">
                การจัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            {stores.data?.items.map((store) => (
              <tr key={store.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{store.code}</td>
                <td className="py-2">{store.name}</td>
                <td className="py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`แก้ไขสาขา ${store.code}`}
                    onClick={() => {
                      setEditing(store);
                      setCode(store.code);
                      setName(store.name);
                    }}
                  >
                    แก้ไข
                  </Button>
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
