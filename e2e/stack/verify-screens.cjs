#!/usr/bin/env node
/**
 * verify-screens.cjs — walks **every** view and menu of the deployment, captures
 * a screenshot per view (desktop + mobile) and records programmatic findings.
 *
 * It is the machine half of the UI review: the screenshots land in
 * `e2e/stack/shots/` and are looked at (visually) afterwards — the checks here
 * only catch what a script can prove:
 *
 *   • console errors / failed requests while the view is open
 *   • exactly one <h1> (the fork's A11y contract)
 *   • no horizontal overflow (a 375 px tablet must not scroll sideways)
 *   • no raw i18n keys leaking into the DOM ("broker.…")
 *   • the view is not empty (a blank page is a bug, not a design)
 *   • dialogs fit the viewport (the mobile dialog fix must hold everywhere)
 *
 * Usage:  node e2e/stack/verify-screens.cjs [--url http://127.0.0.1:18082]
 *                                          [--only broker|base|dialogs]
 */
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const BASE = (() => {
  const i = process.argv.indexOf('--url');
  return i >= 0 ? process.argv[i + 1] : process.env.OE3_BASE || 'http://127.0.0.1:18082';
})();
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1] : 'all';
})();

const SHOTS = join(__dirname, 'shots');
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1400, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

// Every route the app serves (App.tsx) — including the ones that are gated off.
const BASE_VIEWS = [
  { name: 'studies', path: '/oe3/studies', expect: /study|studie/i },
  { name: 'upload', path: '/oe3/upload', expect: /upload|hochladen/i },
  { name: 'activity', path: '/oe3/activity', expect: /activity|aktivität/i },
  { name: 'audit-logs', path: '/oe3/audit-logs', expect: /audit/i },
  { name: 'worklists-off', path: '/oe3/worklists', expect: /worklist/i },
  { name: 'remote-sources', path: '/oe3/remote-sources', expect: /remote|quelle/i },
  { name: 'settings', path: '/oe3/settings', expect: /settings|einstellung/i },
];

// All ten broker pages (the sidebar sub-navigation).
const BROKER_VIEWS = [
  { name: 'broker-overview', path: '/oe3/broker', expect: /mwlb|broker/i },
  { name: 'broker-sources', path: '/oe3/broker/sources', expect: /source|quelle/i },
  { name: 'broker-targets', path: '/oe3/broker/targets', expect: /target|ziel/i },
  { name: 'broker-rules', path: '/oe3/broker/rules', expect: /rule|regel/i },
  { name: 'broker-transforms', path: '/oe3/broker/transforms', expect: /modify|transform/i },
  { name: 'broker-settings', path: '/oe3/broker/settings', expect: /setting|einstellung/i },
  { name: 'broker-spool', path: '/oe3/broker/spool', expect: /spool|warteschlange/i },
  { name: 'broker-worklist', path: '/oe3/broker/worklist', expect: /worklist|arbeitsliste/i },
  { name: 'broker-stations', path: '/oe3/broker/stations', expect: /station/i },
  { name: 'broker-audit', path: '/oe3/broker/audit', expect: /change|änderung|audit/i },
];

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkView(page, view, viewport) {
  const errors = [];
  const onConsole = (msg) => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 160)); };
  const onResponse = (res) => {
    if (res.status() >= 400 && res.url().includes('/oe3/')) {
      errors.push(`HTTP_${res.status()} ${res.url().slice(-60)}`);
    }
  };
  page.on('console', onConsole);
  page.on('response', onResponse);

  await page.goto(`${BASE}${view.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);

  const snapshot = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = (main.innerText || '').trim();
    return {
      text: text.slice(0, 200),
      length: text.length,
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      // a real translation key, not a file name like "mwl-broker.crt":
      // require a word boundary before "broker" that is not a path separator
      rawKeys: (text.match(/(?<![\w/.\-])broker\.[a-zA-Z_]{3,}/g) || []).slice(0, 3),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });

  const tag = `${view.name}-${viewport.name}`;
  await page.screenshot({ path: join(SHOTS, `${tag}.png`), fullPage: true });

  record(`${tag}: keine Konsolenfehler`, errors.length === 0, errors.slice(0, 2).join(' | '));
  record(`${tag}: genau eine H1`, snapshot.h1 === 1, `h1=${snapshot.h1}`);
  record(`${tag}: kein horizontaler Overflow`, !snapshot.overflow,
    `${snapshot.scrollWidth}>${snapshot.innerWidth}`);
  record(`${tag}: keine Rohschlüssel`, snapshot.rawKeys.length === 0, snapshot.rawKeys.join(','));
  record(`${tag}: Ansicht ist nicht leer`, snapshot.length > 40, `${snapshot.length} Zeichen`);
  record(`${tag}: erwarteter Inhalt sichtbar`, view.expect.test(snapshot.text),
    snapshot.text.split('\n')[0].slice(0, 60));

  page.off('console', onConsole);
  page.off('response', onResponse);
  return errors;
}

/** Dialogs are the part of the UI a script most often cannot reach — walk them. */
async function checkDialogs(page, viewport) {
  const tag = (name) => `${name}-${viewport.name}`;

  // source edit dialog (also reachable by clicking the row)
  await page.goto(`${BASE}/oe3/broker/sources`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr, [data-testid="config-row"]', { timeout: 15000 });
  await page.locator('table tbody tr, [data-testid="config-row"]').first().click();
  await page.waitForTimeout(600);
  const dialogFits = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const box = d.getBoundingClientRect();
    return { top: Math.round(box.top), height: Math.round(box.height),
             fits: box.top >= -1 && box.bottom <= window.innerHeight + 1,
             scrollable: getComputedStyle(d).overflowY !== 'visible' };
  });
  await page.screenshot({ path: join(SHOTS, `${tag('dialog-source-edit')}.png`), fullPage: false });
  record(`${tag('dialog-source-edit')}: Dialog passt in den Viewport`,
    dialogFits !== null && dialogFits.fits,
    dialogFits ? `top=${dialogFits.top} height=${dialogFits.height}` : 'kein Dialog');
  if (viewport.name === 'mobile') {
    record(`${tag('dialog-source-edit')}: Dialog ist scrollbar`,
      dialogFits !== null && dialogFits.scrollable);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /verwerfen|discard/i }).last().click().catch(() => {});
  await page.waitForTimeout(400);

  // C-FIND test dialog
  await page.locator('table tbody tr, [data-testid="config-row"]').first()
    .getByRole('button', { name: /worklist-abfrage testen|c-find/i }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(SHOTS, `${tag('dialog-cfind-test')}.png`), fullPage: false });
  const cfind = await page.getByTestId('query-test-result').count();
  record(`${tag('dialog-cfind-test')}: Ergebnis sichtbar`, cfind > 0);
  await page.getByRole('button', { name: /schließen|close/i }).first().click().catch(() => {});
  await page.waitForTimeout(400);

  // worklist preview on the stations page
  await page.goto(`${BASE}/oe3/broker/stations`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /vorschau starten|run preview/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(SHOTS, `${tag('panel-worklist-preview')}.png`), fullPage: false });
  record(`${tag('panel-worklist-preview')}: Vorschau gerendert`,
    (await page.getByTestId('preview-result').count()) > 0);

  // HL7 panel + detail dialog
  await page.goto(`${BASE}/oe3/broker/worklist`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, `${tag('panel-hl7')}.png`), fullPage: false });
  record(`${tag('panel-hl7')}: HL7-Panel gerendert`,
    (await page.getByTestId('broker-hl7').count()) > 0);

  // TLS card (upload form + certificate table)
  await page.goto(`${BASE}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.getByTestId('tls-card').scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: join(SHOTS, `${tag('card-tls')}.png`), fullPage: false });
  record(`${tag('card-tls')}: Zertifikat-Upload sichtbar`,
    (await page.getByTestId('tls-upload').count()) > 0);
  record(`${tag('card-tls')}: Upload-Knopf bis zur Dateiauswahl gesperrt`,
    await page.getByTestId('tls-upload').getByRole('button', { name: /einspielen|install/i }).isDisabled());

  // retention card + purge confirmation
  await page.getByTestId('retention-card').scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: join(SHOTS, `${tag('card-retention')}.png`), fullPage: false });
  record(`${tag('card-retention')}: Aufbewahrungstabelle sichtbar`,
    (await page.getByTestId('retention-tables').count()) > 0);

  // alerting card
  await page.getByTestId('notify-card').scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: join(SHOTS, `${tag('card-alerting')}.png`), fullPage: false });
  record(`${tag('card-alerting')}: Ereigniskatalog sichtbar`,
    (await page.getByTestId('notify-events').count()) > 0);

  // about dialog — the entry lives in the user menu at the bottom left
  await page.goto(`${BASE}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // same selector as verify-ui.cjs: the user menu carries the user name
  const userMenu = page.getByRole('button').filter({ hasText: /admin|oe3-user/i }).first();
  await userMenu.click().catch(() => {});
  await page.waitForTimeout(500);
  const aboutItem = page.getByRole('menuitem', { name: /about/i }).first();
  if (await aboutItem.count()) {
    await aboutItem.click();
  } else {
    await page.getByRole('button', { name: /about|über/i }).first().click().catch(() => {});
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, `${tag('dialog-about')}.png`), fullPage: false });
  record(`${tag('dialog-about')}: About-Dialog geöffnet`,
    (await page.locator('[role="dialog"]').count()) > 0);

  // help dialog ("what is this?")
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /was ist das|what is this/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, `${tag('dialog-help')}.png`), fullPage: false });
  record(`${tag('dialog-help')}: Hilfe-Dialog geöffnet`,
    (await page.getByTestId('page-help-dialog').count()) > 0);
}

(async () => {
  const browser = await chromium.launch();
  const views = [
    ...(ONLY === 'all' || ONLY === 'base' ? BASE_VIEWS : []),
    ...(ONLY === 'all' || ONLY === 'broker' ? BROKER_VIEWS : []),
  ];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: 'de-DE',
    });
    const page = await context.newPage();

    for (const view of views) {
      await checkView(page, view, viewport);
    }
    if (ONLY === 'all' || ONLY === 'dialogs') {
      await checkDialogs(page, viewport);
    }
    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log('='.repeat(70));
  console.log(`=== ${results.length - failed.length}/${results.length} Checks bestanden`);
  console.log(`=== Screenshots: ${SHOTS}`);
  if (failed.length) {
    console.log('=== Fehlgeschlagen:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
  writeFileSync(join(SHOTS, 'screen-report.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
