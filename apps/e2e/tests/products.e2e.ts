import { expect, test } from '@playwright/test';
import { storageState } from './accounts.js';

// #7's Demo: line. Product maintenance is the Administrator's screen, so this walks it with the
// saved admin sign-in; refusal for every other role is proven at the API in
// apps/api/src/products/products.controller.spec.ts, not here.
test.describe('product maintenance', () => {
  test.use({ storageState: storageState('admin') });

  test('create a product, give B01 and B02 different thresholds, then deactivate it and watch it disappear from new documents while staying in search', async ({
    page,
  }) => {
    // This test's own row, so it never collides with another run or another test. The random
    // suffix on top of the timestamp keeps it distinct from a store code another file creates
    // in the same millisecond -- stores.e2e.ts generates codes the same way.
    const sku = `E2EP${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
    const name = 'สินค้าทดสอบอัตโนมัติ';

    await page.goto('/products');

    // Create.
    await page.getByLabel('รหัสสินค้า').fill(sku);
    await page.getByLabel('ชื่อสินค้า').fill(name);
    await page.getByLabel('หมวดหมู่').fill('ทดสอบ');
    await page.getByLabel('หน่วย').fill('ชิ้น');
    await page.getByLabel('ราคาขาย').fill('42');
    await page.getByRole('button', { name: 'เพิ่มสินค้า' }).click();
    const row = page.getByRole('row', { name: new RegExp(sku) });
    await expect(row).toContainText(name);

    // Give B01 and B02 different thresholds (the Demo line's own example).
    await page.getByRole('button', { name: `คลังสินค้าตามสาขาของ ${sku}` }).click();
    const b01 = page.getByRole('row', { name: /B01/ });
    const b02 = page.getByRole('row', { name: /B02/ });
    await b01.getByLabel('เกณฑ์สั่งซื้อซ้ำที่ B01').fill('5');
    await b01.getByRole('button', { name: 'บันทึกเกณฑ์' }).click();
    await expect(b01.getByLabel('เกณฑ์สั่งซื้อซ้ำที่ B01')).toHaveValue('5');
    await b02.getByLabel('เกณฑ์สั่งซื้อซ้ำที่ B02').fill('8');
    await b02.getByRole('button', { name: 'บันทึกเกณฑ์' }).click();
    await expect(b02.getByLabel('เกณฑ์สั่งซื้อซ้ำที่ B02')).toHaveValue('8');
    // Independent: setting B02 did not touch the value already saved for B01.
    await expect(b01.getByLabel('เกณฑ์สั่งซื้อซ้ำที่ B01')).toHaveValue('5');
    // Collapse it again: left open, its per-store rows would otherwise answer later locators
    // meant for the product row alone (including any row for a store another test creates).
    await page.getByRole('button', { name: `ซ่อนคลังสินค้าตามสาขาของ ${sku}` }).click();

    // Deactivate.
    await page.getByRole('button', { name: `แก้ไขสินค้า ${sku}` }).click();
    await page.getByLabel('เปิดใช้งาน').uncheck();
    await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();

    // Stays in search: the admin's own search carries no active filter.
    await page.getByLabel('ค้นหาสินค้า').fill(sku);
    await page.getByRole('button', { name: 'ค้นหา' }).click();
    await expect(page.getByRole('row', { name: new RegExp(sku) })).toContainText('ปิดใช้งาน');

    // Disappears from new documents: checking "active only" is what a document's product
    // picker would ask for, and this ticket owns no document screen beyond that one filter.
    // A plain click, not .check(): the checkbox is controlled from the URL via setSearchParams,
    // whose own navigation can race .check()'s pre/post toggle sampling. The assertion right
    // after is what actually proves the rule, so that race does not matter here.
    await page.getByLabel('แสดงเฉพาะสินค้าที่ใช้งาน').click();
    await expect(page.getByText(new RegExp(`ไม่พบสินค้าที่ตรงกับ`))).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(sku) })).toHaveCount(0);
  });
});

// AC: "A duplicate SKU is rejected across the organisation (Integration)". Same convention as
// stores.e2e.ts's "store code uniqueness": driven over HTTP, because the rule belongs to the
// database constraint and the screen is not what is under test. This is the authoritative gate;
// products.integration.spec.ts is wrapped in skipIf(!DATABASE_URL) and skips in the `check` job.
test.describe('product SKU uniqueness', () => {
  test.use({ storageState: storageState('admin') });

  test('refuses a second product that claims a SKU already in use', async ({ request }) => {
    const sku = `E2EDUP${Date.now()}`;
    const body = {
      sku,
      name: 'สินค้าทดสอบความซ้ำ',
      category: 'ทดสอบ',
      unit: 'ชิ้น',
      sellingPrice: 1,
      active: true,
    };

    const first = await request.post('/api/products', { data: body });
    expect(first.ok(), `creating ${sku} returned ${first.status()}`).toBeTruthy();

    const second = await request.post('/api/products', {
      data: { ...body, name: 'สินค้าทดสอบความซ้ำอีกครั้ง' },
    });
    expect(second.status()).toBe(409);
    // NFR-04: the refusal reaches the client as the catalogue's Thai text, not a Prisma error.
    expect(await second.text()).toContain('รหัสสินค้านี้ถูกใช้แล้ว');
  });
});
