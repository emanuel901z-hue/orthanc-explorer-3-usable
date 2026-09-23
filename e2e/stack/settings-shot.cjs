/** Visuelle Prüfung der Einstellungsseite: sind die neuen Werte beschriftet? */
const { chromium } = require('playwright');
const OE3 = process.env.OE3_BASE || 'http://127.0.0.1:18082';
(async () => {
  const browser = await chromium.launch();
  for (const [label, viewport, mobile] of [['desktop', { width: 1400, height: 900 }, false],
                                           ['mobile', { width: 375, height: 812 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('setting-spool_lease_s').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    const rows = ['spool_lease_s', 'instance_id', 'ha_heartbeat_s', 'mpps_forward_facility', 'hl7_store_raw'];
    const texts = {};
    for (const key of rows) {
      const row = page.getByTestId(`setting-${key}`);
      texts[key] = (await row.count()) ? (await row.first().innerText()).split('\n')[0] : '(fehlt)';
    }
    console.log(label, JSON.stringify(texts, null, 0));
    // Ausschnitt: die neuen Zeilen
    await page.getByTestId('setting-spool_lease_s').screenshot({ path: `/tmp/settings-${label}-lease.png` });
    await page.getByTestId('setting-instance_id').screenshot({ path: `/tmp/settings-${label}-instance.png` });
    await ctx.close();
  }
  await browser.close();
})();
