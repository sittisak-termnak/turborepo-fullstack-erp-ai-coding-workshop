import { expect, test } from '@playwright/test';
import { storageState } from './accounts.js';

// #8's Demo: line. staff_b01 searches and sees only B01 balances, including a product sitting
// at zero. The store-scoping rule itself is proven at the API in
// apps/api/src/stock/stock.controller.spec.ts; this walks the screen a Store employee actually
// uses, with the seeded §8.1 catalogue (SKU003 sits at zero at B01, below its threshold of 3).
test.describe('stock search', () => {
  test.use({ storageState: storageState('staff') });

  test('staff_b01 sees only B01, including SKU003 sitting at zero with the low-stock indicator', async ({
    page,
  }) => {
    await page.goto('/stock');

    // No store filter is offered: there is only ever one store it could apply to.
    await expect(page.getByLabel('ค้นหาตามสาขา')).toHaveCount(0);

    // SKU003 at B01: zero balance, at or below its threshold of 3, so the indicator appears.
    await page.getByLabel('ค้นหาสินค้า').fill('SKU003');
    await page.getByRole('button', { name: 'ค้นหา' }).click();
    const lowRow = page.getByRole('row', { name: /SKU003/ });
    await expect(lowRow).toContainText('B01');
    await expect(lowRow).toContainText('สต็อกต่ำ');
    // Exactly one row: the identical B02 row for the same SKU never reaches this search.
    await expect(page.getByText('ทั้งหมด 1 รายการ')).toBeVisible();

    // SKU002 at B01: above its threshold, so no indicator.
    await page.getByLabel('ค้นหาสินค้า').fill('SKU002');
    await page.getByRole('button', { name: 'ค้นหา' }).click();
    const normalRow = page.getByRole('row', { name: /SKU002/ });
    await expect(normalRow).toContainText('B01');
    await expect(normalRow).not.toContainText('สต็อกต่ำ');
  });
});
