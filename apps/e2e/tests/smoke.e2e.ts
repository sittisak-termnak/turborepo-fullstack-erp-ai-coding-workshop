import { expect, test } from '@playwright/test';

// The one test that ships with the scaffold: the app is up and serves the login page.
// Lesson 10 has the agent write the real Demo: line test next to this file.
test('the login page renders', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText('ระบบจัดการธุรกิจค้าปลีก')).toBeVisible();
  await expect(page.getByLabel('อีเมล')).toBeVisible();
  await expect(page.getByLabel('รหัสผ่าน')).toBeVisible();
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible();
});
