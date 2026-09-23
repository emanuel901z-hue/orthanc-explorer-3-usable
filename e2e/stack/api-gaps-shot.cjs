const { chromium } = require('playwright');
const OE3 = process.env.OE3_BASE || 'http://127.0.0.1:18082';
(async () => {
  const browser = await chromium.launch();
  for (const [label, viewport] of [['desktop', { width: 1400, height: 900 }], ['mobile', { width: 375, height: 812 }]]) {
    const ctx = await browser.newContext({ viewport, locale: 'de-DE' });
    const page = await ctx.newPage();
    await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
    for (const [name, id] of [['storelog', 'broker-store-log'], ['cache', 'broker-cache']]) {
      const card = page.getByTestId(id);
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      await card.screenshot({ path: `/tmp/gaps-${name}-${label}.png` }).catch(() => {});
    }
    await ctx.close();
  }
  await browser.close();
})();
