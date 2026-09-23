/** Visuelle Prüfung des MWL-Interop-Schalters im Quellen-Dialog (Desktop + Mobil). */
const { chromium } = require('playwright');
const OE3 = process.env.OE3_BASE || 'http://127.0.0.1:18082';
(async () => {
  const browser = await chromium.launch();
  for (const [label, viewport, mobile, locale] of [
         ['desktop', { width: 1400, height: 900 }, false, 'en-US'],
         ['mobile', { width: 375, height: 812 }, true, 'en-US'],
         ['desktop-de', { width: 1400, height: 900 }, false, 'de-DE'],
         ['mobile-de', { width: 375, height: 812 }, true, 'de-DE']]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale });
    const page = await ctx.newPage();
    await page.goto(`${OE3}/oe3/broker/sources`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /add source|Quelle hinzufügen/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(800);

    // die neue Gruppe: Schalter + Begründung
    const group = page.getByText(/MWL interoperability|MWL-Interoperabilität/i).first();
    const text = (await group.locator('xpath=ancestor::div[1]').innerText().catch(() => '')) || '';
    console.log(label, JSON.stringify({ groupFound: await group.count() > 0, text: text.slice(0, 220) }));

    const box = group.locator('xpath=ancestor::div[1]');
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await box.screenshot({ path: `/tmp/qrl-${label}-group.png` });
    // Zustand "an" — der Operator muss den Unterschied sehen
    await page.getByRole('switch', { name: /leave out QueryRetrieveLevel|QueryRetrieveLevel weglassen/i }).click();
    await page.waitForTimeout(300);
    await box.screenshot({ path: `/tmp/qrl-${label}-group-on.png` });
    await ctx.close();
  }
  await browser.close();
})();
