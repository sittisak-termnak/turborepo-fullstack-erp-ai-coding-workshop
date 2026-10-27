import { expect, test } from '@playwright/test';
import { storageState } from './accounts.js';

// #6's Demo: line. Supplier maintenance is the Administrator's screen, so this walks it with the
// saved admin sign-in; refusal for every other role is proven at the API in
// apps/api/src/suppliers/suppliers.controller.spec.ts, not here.
test.describe('supplier maintenance', () => {
  test.use({ storageState: storageState('admin') });

  test('create a supplier, edit its contact details, and find it in the paginated list', async ({
    page,
  }) => {
    // This test's own row, so it never collides with another run or another test.
    const code = `E2ESUP${Date.now()}`;
    const name = 'ซัพพลายเออร์ทดสอบอัตโนมัติ';
    const phone = '02-111-2222';
    const address = '1 ถนนสุขุมวิท';

    await page.goto('/suppliers');

    // Create.
    await page.getByLabel('รหัสซัพพลายเออร์').fill(code);
    await page.getByLabel('ชื่อซัพพลายเออร์').fill(name);
    await page.getByRole('button', { name: 'เพิ่มซัพพลายเออร์' }).click();
    await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText(name);

    // Edit its contact details.
    await page.getByRole('button', { name: `แก้ไขซัพพลายเออร์ ${code}` }).click();
    await page.getByLabel('เบอร์โทรศัพท์').fill(phone);
    await page.getByLabel('ที่อยู่').fill(address);
    await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    const row = page.getByRole('row', { name: new RegExp(code) });
    await expect(row).toContainText(phone);
    await expect(row).toContainText(address);

    // Find it in the paginated list. One supplier per page, so the seeded SUP01 and this test's
    // own row together are enough to turn a page without creating twenty rows to prove paging.
    await page.goto('/suppliers?pageSize=1');
    await expect(page.getByText('หน้า 1 จาก')).toBeVisible();

    let found = await page.getByRole('row', { name: new RegExp(code) }).count();
    while (found === 0 && (await page.getByRole('button', { name: 'หน้าถัดไป' }).isEnabled())) {
      await page.getByRole('button', { name: 'หน้าถัดไป' }).click();
      found = await page.getByRole('row', { name: new RegExp(code) }).count();
    }
    await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText(name);
  });
});

// AC: "Supplier codes are unique across the organisation (Integration)". Same convention as
// stores.e2e.ts's "store code uniqueness": driven over HTTP, because the rule belongs to the
// database constraint and the screen is not what is under test. This is the authoritative gate;
// suppliers.integration.spec.ts is wrapped in skipIf(!DATABASE_URL) and skips in the `check` job.
test.describe('supplier code uniqueness', () => {
  test.use({ storageState: storageState('admin') });

  test('refuses a second supplier that claims a code already in use', async ({ request }) => {
    const code = `E2EDUP${Date.now()}`;

    const first = await request.post('/api/suppliers', { data: { code, name: 'ซัพพลายเออร์แรก' } });
    expect(first.ok(), `creating ${code} returned ${first.status()}`).toBeTruthy();

    const second = await request.post('/api/suppliers', {
      data: { code, name: 'ซัพพลายเออร์ซ้ำ' },
    });
    expect(second.status()).toBe(409);
    // NFR-04: the refusal reaches the client as the catalogue's Thai text, not a Prisma error.
    expect(await second.text()).toContain('รหัสซัพพลายเออร์นี้ถูกใช้แล้ว');
  });
});
