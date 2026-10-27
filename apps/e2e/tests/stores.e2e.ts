import { expect, test } from '@playwright/test';
import { storageState } from './accounts.js';

// #5's Demo: line, run by CI. Store maintenance is the Administrator's screen, so this walks it
// with the saved admin sign-in; the refusal for every other role is proven at the API in
// apps/api/src/stores/stores.controller.spec.ts, not here.
test.describe('store maintenance', () => {
  test.use({ storageState: storageState('admin') });

  test('create and edit a store, page through the list, and see the empty state on a filter that matches nothing', async ({
    page,
  }) => {
    // This test's own row, so it never collides with another run or another test.
    const code = `E2E${Date.now()}`;
    const created = 'สาขาทดสอบอัตโนมัติ';
    const renamed = 'สาขาทดสอบเปลี่ยนชื่อแล้ว';

    await page.goto('/stores');

    // Create.
    await page.getByLabel('รหัสสาขา').fill(code);
    await page.getByLabel('ชื่อสาขา').fill(created);
    await page.getByRole('button', { name: 'เพิ่มสาขา' }).click();
    await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText(created);

    // Edit: the code is editable, so the row is addressed by its own edit action.
    await page.getByRole('button', { name: `แก้ไขสาขา ${code}` }).click();
    await page.getByLabel('ชื่อสาขา').fill(renamed);
    await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText(renamed);

    // Page through. One store per page, so the seeded B01 and B02 alone are enough to turn a page
    // and the test never has to create twenty rows to prove paging works.
    await page.goto('/stores?pageSize=1');
    await expect(page.getByText('หน้า 1 จาก')).toBeVisible();
    const firstPage = await page.getByRole('table').textContent();

    await page.getByRole('button', { name: 'หน้าถัดไป' }).click();
    await expect(page.getByText('หน้า 2 จาก')).toBeVisible();
    expect(await page.getByRole('table').textContent()).not.toBe(firstPage);

    await page.getByRole('button', { name: 'หน้าก่อนหน้า' }).click();
    await expect(page.getByText('หน้า 1 จาก')).toBeVisible();

    // The empty state, on a filter that matches nothing. Not a blank panel (AC-05).
    await page.getByLabel('ค้นหาสาขา').fill('ไม่มีสาขาชื่อนี้อยู่จริง');
    await page.getByRole('button', { name: 'ค้นหา' }).click();
    await expect(page.getByText(/ไม่พบสาขาที่ตรงกับ/)).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});

// AC-06 again, at the one seam CI actually gates. stores.integration.spec.ts proves the same
// rule faster locally, but it is wrapped in skipIf(!DATABASE_URL) and the `check` job declares no
// Postgres service, so it skips on every pull request. The `e2e` job has a real database, so this
// is where uniqueness is held. Driven over HTTP rather than the UI: the rule belongs to the
// database constraint, and the screen is not what is under test.
test.describe('store code uniqueness', () => {
  test.use({ storageState: storageState('admin') });

  test('refuses a second store that claims a code already in use', async ({ request }) => {
    const code = `E2EDUP${Date.now()}`;

    const first = await request.post('/api/stores', { data: { code, name: 'สาขาแรก' } });
    expect(first.ok(), `creating ${code} returned ${first.status()}`).toBeTruthy();

    const second = await request.post('/api/stores', { data: { code, name: 'สาขาซ้ำ' } });
    expect(second.status()).toBe(409);
    // NFR-04: the refusal reaches the client as the catalogue's Thai text, not a Prisma error.
    expect(await second.text()).toContain('รหัสสาขานี้ถูกใช้แล้ว');
  });
});
