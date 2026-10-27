import { expect, test } from '@playwright/test';
import { accounts, storageState } from './accounts.js';

// Demo: staff_b01 is refused B02 data by direct API call, and the refusal shows up in the
// audit trail. The refusal is a row-level rule, so this drives the API directly rather than a
// page: hiding a button is never the enforcement (NFR-01).
test.describe('store-scoped authorisation', () => {
  test('staff_b01 is refused B02 by direct API call, and the refusal is audited', async ({
    playwright,
  }) => {
    const staff = await playwright.request.newContext({ storageState: storageState('staff') });
    const admin = await playwright.request.newContext({ storageState: storageState('admin') });

    try {
      // A store employee may read their own store...
      const own = await staff.get('/api/stores/B01');
      expect(own.ok(), `own store returned ${own.status()}`).toBeTruthy();

      // ...but a direct call for another store is refused at the API, not just hidden in the UI.
      const other = await staff.get('/api/stores/B02');
      expect(other.status()).toBe(403);

      // The refusal shows up in the audit trail an Administrator can read.
      const auditResponse = await admin.get('/api/audit');
      expect(auditResponse.ok(), `audit returned ${auditResponse.status()}`).toBeTruthy();
      const records = (await auditResponse.json()) as Array<{
        actorEmail: string;
        action: string;
        target: string | null;
        outcome: string;
      }>;

      const refusal = records.find(
        (r) =>
          r.actorEmail === accounts.staff.email &&
          r.action === 'stores.read' &&
          r.target === 'B02' &&
          r.outcome === 'REFUSED',
      );
      expect(
        refusal,
        'expected a REFUSED stores.read on B02 by staff_b01 in the audit trail',
      ).toBeDefined();

      // The trail is sensitive: a store employee cannot read it.
      const staffAudit = await staff.get('/api/audit');
      expect(staffAudit.status()).toBe(403);
    } finally {
      await staff.dispose();
      await admin.dispose();
    }
  });
});
