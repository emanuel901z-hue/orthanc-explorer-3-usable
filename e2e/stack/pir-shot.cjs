/** Visual check of the PIR card in the states an operator actually sees. */
const { chromium } = require('playwright');
const OE3 = process.env.OE3_BASE || 'http://127.0.0.1:18082';
const API = `${OE3}/broker-api/api/v1`;

(async () => {
  const browser = await chromium.launch();
  // two rows so the badges can be compared side by side
  for (const body of [
    { old_patient_id: 'E2E-VIS-ALT', new_patient_id: 'E2E-VIS-NEU', kind: 'merge', reason: 'Notfall zusammengeführt' },
    { old_patient_id: 'E2E-VIS-MRN2', new_patient_id: 'E2E-VIS-NEU', kind: 'link' },
  ]) {
    await fetch(`${API}/merges`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify(body) });
  }

  for (const [label, viewport, mobile] of [['desktop', { width: 1400, height: 900 }, false],
                                           ['mobile', { width: 375, height: 812 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto(`${OE3}/oe3/broker/worklist`, { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('patient-merge-card');
    await card.first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await card.first().screenshot({ path: `/tmp/pir-${label}-list.png` });

    // a merge being prepared, then the same form as a link
    await card.getByLabel(/alte id|old id/i).fill('E2E-VIS-NEU2');
    await card.getByLabel(/aktuelle id|current id/i).fill('E2E-VIS-NEU');
    await card.getByLabel(/grund|reason/i).fill('zwei MRN, gleiche Person');
    await page.waitForTimeout(300);
    await card.first().screenshot({ path: `/tmp/pir-${label}-merge.png` });

    await card.getByLabel(/^art$|^type$/i).click();
    await page.getByRole('option', { name: /verknüpfen|link/i }).first().click();
    await page.waitForTimeout(300);
    await card.first().screenshot({ path: `/tmp/pir-${label}-link.png` });

    // the refusal a novice earns by typing the same ID twice
    await card.getByLabel(/aktuelle id|current id/i).fill('E2E-VIS-NEU2');
    await page.waitForTimeout(300);
    await card.first().screenshot({ path: `/tmp/pir-${label}-same-id.png` });

    const box = await card.first().boundingBox();
    console.log(`${label}: ${Math.round(box.width)}x${Math.round(box.height)}`,
      '| alert:', await card.getByTestId('pir-same-id').count(),
      '| rows:', await page.getByTestId('merge-list').locator('li').count());
    await ctx.close();
  }
  await browser.close();

  for (const row of (await (await fetch(`${API}/merges`)).json())) {
    if (row.old_patient_id.startsWith('E2E-VIS-')) {
      await fetch(`${API}/merges/${row.id}`, { method: 'DELETE' });
    }
  }
})();
