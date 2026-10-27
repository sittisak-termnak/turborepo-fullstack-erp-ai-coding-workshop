import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { PRODUCT_PAGE_SIZE_DEFAULT, type Product } from '@erp/contracts';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { ListState } from '@/components/list-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { orpc } from '@/lib/orpc';

/** A positive integer from the query string, or the fallback when it is missing or nonsense. */
function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const emptyForm = { sku: '', name: '', category: '', unit: '', sellingPrice: '' };

/**
 * Product maintenance (MD-01), with the reorder threshold MD-01 puts per store rather than on
 * the product itself. The Administrator's screen: the API refuses every other role.
 *
 * `active` on the list query is the one seam MD-02's "inactive on new documents" rule reaches in
 * this ticket: unchecked, the search below finds every status, including a deactivated product;
 * checked, it asks the same endpoint a new document's product picker would ask, so a deactivated
 * product disappears from that view without a document screen existing yet.
 */
export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = positiveInt(searchParams.get('pageSize'), PRODUCT_PAGE_SIZE_DEFAULT);
  const q = searchParams.get('q') ?? '';
  const activeOnly = searchParams.get('active') === 'true';

  const queryClient = useQueryClient();
  const products = useQuery(
    orpc.products.list.queryOptions({
      input: { page, pageSize, ...(q ? { q } : {}), ...(activeOnly ? { active: true } : {}) },
    }),
  );

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [active, setActive] = useState(true);
  const [filter, setFilter] = useState(q);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
    setActive(true);
  };
  // Every page of the list is stale after a write, so invalidate the whole list, not one page.
  const refreshList = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.products.list.key() });
    reset();
  };

  const create = useMutation(orpc.products.create.mutationOptions({ onSuccess: refreshList }));
  const update = useMutation(orpc.products.update.mutationOptions({ onSuccess: refreshList }));
  const saving = editing ? update : create;

  const total = products.data?.total;

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
      <h1 className="text-xl font-semibold">จัดการสินค้า</h1>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? `แก้ไขสินค้า ${editing.sku}` : 'เพิ่มสินค้าใหม่'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const input = { ...form, sellingPrice: Number(form.sellingPrice), active };
              if (editing) update.mutate({ id: editing.id, ...input });
              else create.mutate(input);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="product-sku">รหัสสินค้า</Label>
              <Input
                id="product-sku"
                required
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-name">ชื่อสินค้า</Label>
              <Input
                id="product-name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">หมวดหมู่</Label>
              <Input
                id="product-category"
                required
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-unit">หน่วย</Label>
              <Input
                id="product-unit"
                required
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">ราคาขาย</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.sellingPrice}
                onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input
                id="product-active"
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="size-4"
              />
              <Label htmlFor="product-active">เปิดใช้งาน</Label>
            </div>
            <Button type="submit" disabled={saving.isPending}>
              {editing ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
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
          <Label htmlFor="product-filter">ค้นหาสินค้า</Label>
          <Input
            id="product-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
        <div className="flex items-center gap-2 pb-2">
          <input
            id="product-active-only"
            type="checkbox"
            checked={activeOnly}
            onChange={(event) =>
              goTo({ active: event.target.checked ? 'true' : undefined, page: undefined })
            }
            className="size-4"
          />
          <Label htmlFor="product-active-only">แสดงเฉพาะสินค้าที่ใช้งาน</Label>
        </div>
      </form>

      {total !== undefined && (
        <p className="text-sm text-muted-foreground">ทั้งหมด {total} สินค้า</p>
      )}

      <ListState
        isPending={products.isPending}
        error={products.error}
        isEmpty={products.data?.items.length === 0}
        emptyMessage={q ? `ไม่พบสินค้าที่ตรงกับ “${q}”` : 'ไม่พบสินค้า ยังไม่มีสินค้าในระบบ'}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">รายการสินค้าทั้งหมด เรียงจากที่เพิ่มล่าสุด</caption>
          <thead className="border-b">
            <tr>
              <th scope="col" className="py-2">
                รหัสสินค้า
              </th>
              <th scope="col" className="py-2">
                ชื่อสินค้า
              </th>
              <th scope="col" className="py-2">
                หมวดหมู่
              </th>
              <th scope="col" className="py-2">
                ราคา
              </th>
              <th scope="col" className="py-2">
                สถานะ
              </th>
              <th scope="col" className="py-2 text-right">
                การจัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            {products.data?.items.map((product) => (
              <Fragment key={product.id}>
                <tr className="border-b last:border-0">
                  <td className="py-2 font-medium">{product.sku}</td>
                  <td className="py-2">{product.name}</td>
                  <td className="py-2">{product.category}</td>
                  <td className="py-2">{formatMoney(product.sellingPrice)}</td>
                  <td className="py-2">
                    <Badge variant={product.active ? 'default' : 'outline'}>
                      {product.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`แก้ไขสินค้า ${product.sku}`}
                        onClick={() => {
                          setEditing(product);
                          setForm({
                            sku: product.sku,
                            name: product.name,
                            category: product.category,
                            unit: product.unit,
                            sellingPrice: String(product.sellingPrice),
                          });
                          setActive(product.active);
                        }}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={
                          expanded === product.id
                            ? `ซ่อนคลังสินค้าตามสาขาของ ${product.sku}`
                            : `คลังสินค้าตามสาขาของ ${product.sku}`
                        }
                        onClick={() => setExpanded(expanded === product.id ? null : product.id)}
                      >
                        {expanded === product.id ? 'ซ่อนคลังสินค้า' : 'คลังสินค้าตามสาขา'}
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded === product.id && (
                  <tr className="border-b last:border-0">
                    <td colSpan={6} className="bg-muted/30 py-3">
                      <ProductStores productId={product.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
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

/**
 * The reorder threshold per store (MD-01). Every row here was already created eagerly by the
 * API, so this is read and edit only: the Demo line's "give B01 and B02 different thresholds".
 */
function ProductStores({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery(orpc.productStores.listForProduct.queryOptions({ input: { productId } }));
  const update = useMutation(
    orpc.productStores.updateThreshold.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.productStores.listForProduct.key({ input: { productId } }),
        }),
    }),
  );

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลคลังสินค้า…</p>;
  }
  if (query.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(query.error)}
      </p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">ยอดคงเหลือและเกณฑ์สั่งซื้อซ้ำของสินค้านี้ แยกตามสาขา</caption>
      <thead>
        <tr>
          <th scope="col" className="py-1">
            สาขา
          </th>
          <th scope="col" className="py-1">
            ยอดคงเหลือ
          </th>
          <th scope="col" className="py-1">
            เกณฑ์สั่งซื้อซ้ำ
          </th>
          <th scope="col" className="py-1" />
        </tr>
      </thead>
      <tbody>
        {query.data?.map((row) => (
          <ProductStoreRow
            key={row.storeId}
            row={row}
            onSave={(reorderThreshold) =>
              update.mutate({ productId, storeId: row.storeId, reorderThreshold })
            }
            saving={update.isPending}
          />
        ))}
      </tbody>
      {update.error && (
        <caption className="pt-2 text-left">
          <span role="alert" className="text-sm text-destructive">
            {errorMessage(update.error)}
          </span>
        </caption>
      )}
    </table>
  );
}

function ProductStoreRow({
  row,
  onSave,
  saving,
}: {
  row: {
    storeId: string;
    storeCode: string;
    storeName: string;
    balance: number;
    reorderThreshold: number;
  };
  onSave: (reorderThreshold: number) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(String(row.reorderThreshold));

  return (
    <tr>
      <td className="py-1">
        {row.storeCode} ({row.storeName})
      </td>
      <td className="py-1">{row.balance}</td>
      <td className="py-1">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(Number(value));
          }}
        >
          <Label htmlFor={`threshold-${row.storeId}`} className="sr-only">
            {`เกณฑ์สั่งซื้อซ้ำที่ ${row.storeCode}`}
          </Label>
          <Input
            id={`threshold-${row.storeId}`}
            type="number"
            min="0"
            step="1"
            className="h-8 w-20"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" disabled={saving}>
            บันทึกเกณฑ์
          </Button>
        </form>
      </td>
    </tr>
  );
}
