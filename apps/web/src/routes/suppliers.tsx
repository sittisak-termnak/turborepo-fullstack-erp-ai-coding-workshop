import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { SUPPLIER_PAGE_SIZE_DEFAULT, type Supplier } from '@erp/contracts';
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
 * Supplier maintenance (MD-03). The Administrator's screen, mirroring stores.tsx: the API
 * refuses every other role, which is the enforcement; this screen is only the way in.
 *
 * `phone` and `address` are the only contact details #6 scopes in, both optional. The page, like
 * stores.tsx, reuses the pagination and list-state primitives #5 landed; unlike stores.tsx, this
 * ticket's acceptance criteria name no search filter, so there is none.
 */
export function SuppliersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = positiveInt(searchParams.get('pageSize'), SUPPLIER_PAGE_SIZE_DEFAULT);

  const queryClient = useQueryClient();
  const suppliers = useQuery(orpc.suppliers.list.queryOptions({ input: { page, pageSize } }));

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const reset = () => {
    setEditing(null);
    setCode('');
    setName('');
    setPhone('');
    setAddress('');
  };
  // Every page of the list is stale after a write, so invalidate the whole list, not one page.
  const refreshList = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.suppliers.list.key() });
    reset();
  };

  const create = useMutation(orpc.suppliers.create.mutationOptions({ onSuccess: refreshList }));
  const update = useMutation(orpc.suppliers.update.mutationOptions({ onSuccess: refreshList }));
  const saving = editing ? update : create;

  const total = suppliers.data?.total;

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
      <h1 className="text-xl font-semibold">จัดการซัพพลายเออร์</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? `แก้ไขซัพพลายเออร์ ${editing.code}` : 'เพิ่มซัพพลายเออร์ใหม่'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const input = { code, name, phone: phone || null, address: address || null };
              if (editing) update.mutate({ id: editing.id, ...input });
              else create.mutate(input);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="supplier-code">รหัสซัพพลายเออร์</Label>
              <Input
                id="supplier-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-name">ชื่อซัพพลายเออร์</Label>
              <Input
                id="supplier-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">เบอร์โทรศัพท์</Label>
              <Input
                id="supplier-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-address">ที่อยู่</Label>
              <Input
                id="supplier-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving.isPending}>
              {editing ? 'บันทึกการแก้ไข' : 'เพิ่มซัพพลายเออร์'}
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

      {total !== undefined && (
        <p className="text-sm text-muted-foreground">ทั้งหมด {total} ซัพพลายเออร์</p>
      )}

      <ListState
        isPending={suppliers.isPending}
        error={suppliers.error}
        isEmpty={suppliers.data?.items.length === 0}
        emptyMessage="ไม่พบซัพพลายเออร์ ยังไม่มีซัพพลายเออร์ในระบบ"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">รายการซัพพลายเออร์ทั้งหมด เรียงจากที่เพิ่มล่าสุด</caption>
          <thead className="border-b">
            <tr>
              <th scope="col" className="py-2">
                รหัสซัพพลายเออร์
              </th>
              <th scope="col" className="py-2">
                ชื่อซัพพลายเออร์
              </th>
              <th scope="col" className="py-2">
                เบอร์โทรศัพท์
              </th>
              <th scope="col" className="py-2">
                ที่อยู่
              </th>
              <th scope="col" className="py-2 text-right">
                การจัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.data?.items.map((supplier) => (
              <tr key={supplier.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{supplier.code}</td>
                <td className="py-2">{supplier.name}</td>
                <td className="py-2">{supplier.phone ?? '-'}</td>
                <td className="py-2">{supplier.address ?? '-'}</td>
                <td className="py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`แก้ไขซัพพลายเออร์ ${supplier.code}`}
                    onClick={() => {
                      setEditing(supplier);
                      setCode(supplier.code);
                      setName(supplier.name);
                      setPhone(supplier.phone ?? '');
                      setAddress(supplier.address ?? '');
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
