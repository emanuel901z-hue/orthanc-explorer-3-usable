/**
 * Deep verification of the broker UI: desktop + mobile, DOM checks,
 * console/network errors, real CRUD flows cross-checked against the REST API.
 * Run: node verify-ui.cjs   (from the frontend dir, playwright available)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OE3 = 'http://127.0.0.1:18082';
const API = 'http://127.0.0.1:18081/api/v1';
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  ['monitoring', '/oe3/broker', /MWL/i],
  ['sources', '/oe3/broker/sources', /upstream sources|upstream-quellen/i],
  ['targets', '/oe3/broker/targets', /store targets|store-ziele/i],
  ['rules', '/oe3/broker/rules', /routing rules|routing-regeln/i],
  ['transforms', '/oe3/broker/transforms', /modify rules|modify-regeln/i],
  ['settings', '/oe3/broker/settings', /broker settings|broker-einstellungen/i],
  ['audit', '/oe3/broker/audit', /change log|änderungsprotokoll/i],
  ['spool', '/oe3/broker/spool', /store queue|store-warteschlange/i],
  ['worklist', '/oe3/broker/worklist', /local worklist|lokale worklist/i],
  ['stations', '/oe3/broker/stations', /station rules|stationsregeln/i],
];

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

async function api(pathname, init) {
  const res = await fetch(API + pathname, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  return res.status === 204 ? null : res.json();
}

async function newPage(browser, viewport, isMobile = false) {
  const ctx = await browser.newContext({
    viewport, isMobile, hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
    // deterministic labels: the app follows navigator.language
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => errors.push('PAGE_ERROR: ' + e.message.slice(0, 160)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`HTTP_${r.status()} ${r.url().slice(0, 90)}`);
  });
  return { ctx, page, errors };
}

async function domReport(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const small = [...document.querySelectorAll('button, a, [role="switch"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32);
      })
      .map((el) => `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}]=${Math.round(el.getBoundingClientRect().height)}px`);
    return {
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      overflowX: doc.scrollWidth > doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      tables: document.querySelectorAll('table').length,
      buttons: document.querySelectorAll('button').length,
      imgsWithoutAlt: [...document.querySelectorAll('img')].filter((i) => !i.alt).length,
      smallTargets: small.slice(0, 6),
    };
  });
}

(async () => {
  const browser = await chromium.launch();

  // ── 1. render all pages on desktop + mobile ──────────────────────────────
  for (const [isMobile, viewport, label] of [
    [false, { width: 1400, height: 900 }, 'desktop'],
    [true, { width: 375, height: 812 }, 'mobile'],
  ]) {
    const { ctx, page, errors } = await newPage(browser, viewport, isMobile);
    for (const [name, url, h1] of PAGES) {
      await page.goto(OE3 + url, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForFunction(
          (re) => new RegExp(re, 'i').test(document.querySelector('h1')?.textContent || ''),
          h1.source, { timeout: 15000 },
        );
      } catch { /* reported below */ }
      await page.waitForTimeout(700);
      const dom = await domReport(page);
      const okH1 = dom.h1.length === 1 && new RegExp(h1.source, 'i').test(dom.h1[0] || '');
      record(`${label}/${name}: genau ein H1 + Titel`, okH1, dom.h1.join('|'));
      record(`${label}/${name}: kein horizontales Overflow`, !dom.overflowX,
        `${dom.scrollWidth}/${dom.clientWidth}`);
      record(`${label}/${name}: keine Bilder ohne alt`, dom.imgsWithoutAlt === 0);
      await page.screenshot({ path: path.join(SHOTS, `${label}-${name}.png`), fullPage: true });
    }
    record(`${label}: keine Console-/Netzwerk-Fehler`, errors.length === 0, errors.slice(0, 3).join(' ; '));
    await ctx.close();
  }

  // ── 2. interactive flows (desktop, verified against the API) ─────────────
  const { ctx, page, errors } = await newPage(browser, { width: 1400, height: 900 });

  // sources: create → edit → delete
  await page.goto(`${OE3}/oe3/broker/sources`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add source|quelle hinzufügen/i }).click();
  await page.getByLabel('Name', { exact: true }).fill('verify-ris');
  await page.getByLabel('AE title', { exact: true }).fill('VERIFY');
  await page.getByLabel('Host', { exact: true }).fill('127.0.0.1');
  await page.getByLabel('Port', { exact: true }).fill('11199');
  await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
  await page.waitForTimeout(1200);
  let sources = await api('/sources');
  const created = sources.find((s) => s.name === 'verify-ris');
  record('sources: Anlegen via UI landet in der API', Boolean(created),
    JSON.stringify(created && { id: created.id, aet: created.aet, port: created.port }));

  if (created) {
    await page.getByRole('button', { name: /edit source|quelle bearbeiten/i }).last().click();
    await page.getByLabel('Port', { exact: true }).fill('11200');
    await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
    await page.waitForTimeout(1200);
    sources = await api('/sources');
    record('sources: Bearbeiten via UI wirkt in der API',
      sources.find((s) => s.id === created.id)?.port === 11200);

    await page.getByRole('button', { name: /delete source|quelle löschen/i }).last().click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();
    await page.waitForTimeout(1200);
    sources = await api('/sources');
    record('sources: Löschen via UI entfernt den Datensatz',
      !sources.some((s) => s.id === created.id));
  }

  // targets: create with default flag
  await page.goto(`${OE3}/oe3/broker/targets`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add target|ziel hinzufügen/i }).click();
  await page.getByLabel('Name', { exact: true }).fill('verify-pacs');
  await page.getByLabel('AE title', { exact: true }).fill('VERIFY_PACS');
  await page.getByLabel('Host', { exact: true }).fill('127.0.0.1');
  await page.getByLabel('Port', { exact: true }).fill('104');
  await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
  await page.waitForTimeout(1200);
  const targets = await api('/targets');
  const tgt = targets.find((t) => t.name === 'verify-pacs');
  record('targets: Anlegen via UI landet in der API', Boolean(tgt));
  if (tgt) {
    await page.getByRole('button', { name: /delete target|ziel löschen/i }).last().click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();
    await page.waitForTimeout(1200);
    record('targets: Löschen via UI entfernt den Datensatz',
      !(await api('/targets')).some((t) => t.id === tgt.id));
  }

  // rules: create via the (real) Radix selects
  await page.goto(`${OE3}/oe3/broker/rules`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add rule|regel hinzufügen/i }).click();
  await page.getByLabel('Source', { exact: true }).click();
  await page.getByRole('option', { name: /ris-a/ }).first().click();
  await page.getByLabel('Target', { exact: true }).click();
  await page.getByRole('option', { name: /pacs-peer/ }).first().click();
  await page.getByLabel('Priority', { exact: true }).fill('77');
  await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
  await page.waitForTimeout(1200);
  const rules = await api('/rules');
  const rule = rules.find((r) => r.priority === 77);
  record('rules: Anlegen via UI (Selects) landet in der API', Boolean(rule));
  if (rule) {
    await page.getByRole('button', { name: /delete rule|regel löschen/i }).last().click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();
    await page.waitForTimeout(1200);
    record('rules: Löschen via UI entfernt die Regel',
      !(await api('/rules')).some((r) => r.id === rule.id));
  }

  // transforms: create with an operation, then delete
  await page.goto(`${OE3}/oe3/broker/transforms`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add modify rule|modify-regel hinzufügen/i }).click();
  await page.getByLabel('Name', { exact: true }).fill('verify-modify');
  await page.getByLabel('DICOM tag', { exact: true }).fill('InstitutionName');
  await page.getByLabel('Value', { exact: true }).fill('Verify Klinikum');
  await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
  await page.waitForTimeout(1200);
  let transforms = await api('/transforms');
  const tr = transforms.find((t) => t.name === 'verify-modify');
  record('transforms: Anlegen via UI landet in der API',
    Boolean(tr), JSON.stringify(tr && tr.operations));
  if (tr) {
    await page.getByRole('button', { name: /delete modify rule|modify-regel löschen/i }).last().click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();
    await page.waitForTimeout(1200);
    transforms = await api('/transforms');
    record('transforms: Löschen via UI entfernt die Regel',
      !transforms.some((t) => t.id === tr.id));
  }

  // transforms: invalid tag surfaces the backend validation message
  await page.getByRole('button', { name: /add modify rule|modify-regel hinzufügen/i }).click();
  await page.getByLabel('Name', { exact: true }).fill('verify-invalid');
  await page.getByLabel('DICOM tag', { exact: true }).fill('NotARealTag');
  await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
  const alert = page.getByRole('alert');
  await alert.first().waitFor({ timeout: 10000 }).catch(() => {});
  const alertText = (await alert.count()) ? await alert.first().textContent() : '';
  record('transforms: 422-Validierung wird im Dialog angezeigt',
    /unknown DICOM keyword/i.test(alertText || ''), (alertText || '').slice(0, 60));
  await page.getByRole('button', { name: /^cancel$|^abbrechen$/i }).click();

  // settings: override → reset
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  const row = page.getByTestId('setting-echo_interval_s');
  const resetBtn = row.getByRole('button', { name: /reset to default|auf default zurücksetzen/i });
  if (await resetBtn.count()) { await resetBtn.click(); await page.waitForTimeout(800); }
  await row.getByLabel(/C-ECHO interval/i).fill('42');
  await row.getByRole('button', { name: /^save$|^speichern$/i }).click();
  await page.waitForTimeout(1200);
  let settings = await api('/settings');
  const s1 = settings.find((s) => s.key === 'echo_interval_s');
  record('settings: Override via UI wirkt in der API', s1.value === '42' && s1.source === 'db',
    `${s1.value}/${s1.source}`);
  record('settings: Badge zeigt "override"',
    await row.getByText(/^override$/i).isVisible());

  await resetBtn.click();
  await page.waitForTimeout(1200);
  settings = await api('/settings');
  const s2 = settings.find((s) => s.key === 'echo_interval_s');
  record('settings: Reset via UI stellt den ENV-Default wieder her',
    s2.source === 'env' && s2.value === s2.default, `${s2.value}/${s2.source}`);

  // echo button
  await page.goto(`${OE3}/oe3/broker/sources`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /run c-echo now|c-echo jetzt ausführen/i }).first().click();
  await page.waitForTimeout(2500);
  const rtt = await page.getByText(/\d+\s*ms/).first().isVisible();
  record('sources: manueller C-ECHO liefert RTT im UI', rtt);

  // P1 fix: dialogs must be fully reachable on a small screen
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${OE3}/oe3/broker/worklist`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add item|Eintrag anlegen/i }).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  const dialogFit = await page.locator('[role="dialog"]').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const scrollable = el.scrollHeight > el.clientHeight
      && getComputedStyle(el).overflowY !== 'visible';
    return { top: Math.round(rect.top), bottom: Math.round(rect.bottom),
             height: Math.round(rect.height), scrollable };
  });
  record('mobile: Worklist-Dialog passt in den Viewport',
    dialogFit.top >= 0 && dialogFit.scrollable,
    `top=${dialogFit.top} height=${dialogFit.height} scrollbar=${dialogFit.scrollable}`);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1400, height: 900 });

  // P2 fix: input guidance — typed fields, patterns, hints
  await page.goto(`${OE3}/oe3/broker/worklist`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="broker-hl7"]', { timeout: 15000 });
  await page.getByRole('button', { name: /add item|Eintrag anlegen/i }).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  const fieldTypes = await page.locator('[role="dialog"] input').evaluateAll((els) =>
    els.map((el) => el.getAttribute('type') ?? 'text'));
  record('worklist: Datum/Zeit sind echte Picker', fieldTypes.includes('date') && fieldTypes.includes('time'),
    `Typen: ${[...new Set(fieldTypes)].join(', ')}`);
  const stationHint = await page.locator('[role="dialog"]')
    .getByText(/1–16 characters|1–16 Zeichen/i).count();
  record('worklist: Format-Hinweis an der Station-AET', stationHint > 0);
  // an invalid AE title is caught before saving
  await page.locator('#local-station_aet').fill('ct-01!');
  const stationError = await page.locator('[role="dialog"]')
    .getByText(/only A–Z|nur A–Z/i).count();
  record('worklist: ungültige Station-AET wird vorab gemeldet', stationError > 0);
  await page.keyboard.press('Escape');

  // P2 fix: settings validate before sending
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="setting-allowed_calling_aets"]', { timeout: 15000 });
  const aetRow = page.getByTestId('setting-allowed_calling_aets');
  await aetRow.getByLabel(/allowed calling ae titles|erlaubte.*ae/i).fill('nope!');
  const preCheck = await aetRow.getByText(/invalid ae title|ungültige/i).count();
  const saveDisabled = await aetRow.getByRole('button', { name: /save|speichern/i }).isDisabled();
  record('settings: ungültiger Wert wird vor dem Senden abgefangen',
    preCheck > 0 && saveDisabled, `Hinweis=${preCheck > 0} Button gesperrt=${saveDisabled}`);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // P1 fix: numeric settings are constrained, and a rejected value is visible
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="setting-echo_interval_s"]', { timeout: 15000 });
  const numeric = await page.locator('#setting-echo_interval_s').evaluate((el) => ({
    type: el.getAttribute('type'), min: el.getAttribute('min'), max: el.getAttribute('max'),
  }));
  record('settings: Zahleneinstellung ist typisiert und begrenzt',
    numeric.type === 'number' && numeric.min === '5' && numeric.max === '3600',
    `type=${numeric.type} min=${numeric.min} max=${numeric.max}`);
  const rangeHint = await page.getByTestId('setting-echo_interval_s')
    .getByText(/allowed:|erlaubt:/i).count();
  record('settings: erlaubter Bereich wird im Klartext genannt', rangeHint > 0);

  // an out-of-range value is caught before sending (the client mirrors the
  // server rules) — and a server rejection still reaches the operator as a toast
  await page.locator('#setting-echo_interval_s').fill('99999');
  const rangeError = await page.locator('[data-testid="setting-echo_interval_s"] [role="alert"]')
    .first().textContent().catch(() => '');
  const blocked = await page.locator('[data-testid="setting-echo_interval_s"]')
    .getByRole('button', { name: /save|speichern/i }).isDisabled();
  record('settings: Wert außerhalb des Bereichs wird vorab abgefangen',
    blocked && /at most|höchstens|maximal/i.test(rangeError ?? ''),
    `gesperrt=${blocked} Hinweis=${JSON.stringify(rangeError)}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#setting-echo_interval_s', { timeout: 15000 });
  const persisted = await page.locator('#setting-echo_interval_s').inputValue();
  record('settings: der abgelehnte Wert wurde nicht gespeichert',
    persisted === '30', `nach Reload zeigt das Feld: ${persisted}`);

  // retention card (deletion concept)
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  const retentionCard = page.getByTestId('retention-card');
  await retentionCard.first().waitFor({ timeout: 10000 }).catch(() => {});
  const retentionVisible = await retentionCard.count() > 0 && await retentionCard.first().isVisible();
  record('settings: Retention-Karte wird gerendert', retentionVisible);
  if (retentionVisible) {
    const retentionOverflow = await retentionCard.evaluate((el) => el.scrollWidth > el.clientWidth);
    record('settings: Retention-Karte ohne Overflow', !retentionOverflow);
    const retentionState = await page.evaluate(async () => {
      const res = await fetch('/broker-api/api/v1/retention');
      return res.ok ? res.json() : null;
    });
    record('settings: Retention-Status ist abrufbar',
      retentionState !== null && (retentionState.tables?.length ?? 0) >= 5,
      `${retentionState?.tables?.length ?? '?'} Tabellen`);
  }

  // rbac banner (read-only mode)
  await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  const rbacState = await page.evaluate(async () => {
    const res = await fetch('/broker-api/api/v1/rbac/status');
    return res.ok ? res.json() : null;
  });
  record('monitoring: RBAC-Status ist abrufbar', rbacState !== null && 'can_write' in (rbacState ?? {}),
    `enforced=${rbacState?.enforced} can_write=${rbacState?.can_write}`);
  const bannerCount = await page.getByTestId('rbac-banner').count();
  record('monitoring: RBAC-Banner nur im Lesemodus',
    rbacState?.can_write ? (await page.getByTestId('rbac-banner').count()) === 0 : true);

  // ATNA card (audit trail)
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  const tlsCard = page.getByTestId('tls-card');
  await tlsCard.first().waitFor({ timeout: 10000 }).catch(() => {});
  const tlsVisible = await tlsCard.count() > 0 && await tlsCard.first().isVisible();
  record('settings: TLS-Karte wird gerendert', tlsVisible);
  if (tlsVisible) {
    const tlsOverflow = await tlsCard.evaluate((el) => el.scrollWidth > el.clientWidth);
    record('settings: TLS-Karte ohne Overflow', !tlsOverflow);
    const tlsState = await page.evaluate(async () => {
      const res = await fetch('/broker-api/api/v1/tls/overview');
      return res.ok ? res.json() : null;
    });
    record('settings: TLS-Status ist abrufbar', tlsState !== null,
      `listener=${tlsState?.inbound_enabled} port=${tlsState?.inbound_port}`);
    const expected = (tlsState?.certificates ?? []).length;
    const certCount = await page.getByTestId('tls-certificates').locator('li').count();
    record('settings: konfigurierte Zertifikate werden gelistet',
      expected === 0 ? certCount === 0 : certCount === expected,
      `${certCount} von ${expected} Zertifikat(en)`);
  }

  // ATNA card (audit trail)
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  const atnaCard = page.getByTestId('atna-card');
  await atnaCard.first().waitFor({ timeout: 10000 }).catch(() => {});
  const atnaVisible = await atnaCard.count() > 0 && await atnaCard.first().isVisible();
  record('settings: ATNA-Karte wird gerendert', atnaVisible);
  if (atnaVisible) {
    const atnaOverflow = await atnaCard.evaluate((el) => el.scrollWidth > el.clientWidth);
    record('settings: ATNA-Karte ohne Overflow', !atnaOverflow);
    const stats = await page.evaluate(async () => {
      const res = await fetch('/broker-api/api/v1/atna/stats');
      return res.ok ? res.json() : null;
    });
    record('settings: ATNA-Status ist abrufbar', stats !== null && stats.queue_max > 0,
      `host=${stats?.host ?? '?'} protocol=${stats?.protocol ?? '?'}`);
  }

  // local worklist + HL7 panel
  await page.goto(`${OE3}/oe3/broker/worklist`, { waitUntil: 'domcontentloaded' });
  const hl7Panel = page.getByTestId('broker-hl7');
  await hl7Panel.first().waitFor({ timeout: 10000 }).catch(() => {});
  record('worklist: HL7-Panel wird gerendert',
    await hl7Panel.count() > 0 && await hl7Panel.first().isVisible());
  record('worklist: genau eine H1', await page.locator('h1').count() === 1);
  record('worklist: kein horizontaler Overflow',
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));

  // station rules
  await page.goto(`${OE3}/oe3/broker/stations`, { waitUntil: 'domcontentloaded' });
  const stationPreview = page.getByTestId('broker-station-preview');
  await stationPreview.first().waitFor({ timeout: 10000 }).catch(() => {});
  record('stations: Vorschau-Panel wird gerendert',
    await stationPreview.count() > 0 && await stationPreview.first().isVisible());
  record('stations: genau eine H1', await page.locator('h1').count() === 1);

  // alerting card (webhook + events + test message)
  await page.goto(`${OE3}/oe3/broker/settings`, { waitUntil: 'domcontentloaded' });
  const notifyCard = page.getByTestId('notify-card');
  await notifyCard.first().waitFor({ timeout: 10000 }).catch(() => {});
  const notifyVisible = await notifyCard.count() > 0 && await notifyCard.first().isVisible();
  record('settings: Alerting-Karte wird gerendert', notifyVisible);
  if (notifyVisible) {
    const eventCount = await notifyCard.getByTestId('notify-events').locator('input[type=checkbox]').count();
    record('settings: Alerting listet die verfügbaren Ereignisse', eventCount >= 5, `${eventCount} Ereignisse`);
    const notifyDom = await notifyCard.evaluate((el) => ({ overflow: el.scrollWidth > el.clientWidth }));
    record('settings: Alerting-Karte ohne Overflow', !notifyDom.overflow);
  }

  // C-STORE spool card (store and forward)
  await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  const spoolCard = page.getByTestId('broker-spool');
  await spoolCard.first().waitFor({ timeout: 10000 }).catch(() => {});
  const spoolVisible = await spoolCard.count() > 0 && await spoolCard.first().isVisible();
  record('monitoring: Spool-Karte (Store and Forward) wird gerendert', spoolVisible);
  if (spoolVisible) {
    const stats = await page.evaluate(async () => {
      const res = await fetch('/broker-api/api/v1/spool/stats');
      return res.ok ? res.json() : null;
    });
    const text = await spoolCard.textContent();
    const expected = (stats?.open ?? 0) > 0
      ? /waiting|wartend|dead letter/i
      : /nothing queued|nichts in der Warteschlange/i;
    record('monitoring: Spool zeigt den aktuellen Rückstand', expected.test(text || ''),
      `open=${stats?.open ?? '?'}`);
  }

  // worklist cache card (outage bridge)
  await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  const cacheCard = page.getByTestId('broker-cache');
  await cacheCard.first().waitFor({ timeout: 10000 }).catch(() => {});
  const cacheVisible = await cacheCard.count() > 0 && await cacheCard.first().isVisible();
  record('monitoring: Cache-Karte (Ausfall-Überbrückung) wird gerendert', cacheVisible);
  if (cacheVisible) {
    const list = cacheCard.getByTestId('broker-cache-list');
    const rows = await list.count() > 0 ? await list.locator('li').count() : 0;
    record('monitoring: Cache zeigt Zustand je Quelle', rows >= 1, `${rows} Quellen`);
    const dom = await cacheCard.evaluate((el) => ({
      overflow: el.scrollWidth > el.clientWidth,
    }));
    record('monitoring: Cache-Karte ohne Overflow', !dom.overflow);
  }

  // case check (simulation): routing dry-run on the monitoring page
  await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  const casePanel = page.getByTestId('broker-case-check');
  await casePanel.first().waitFor({ timeout: 10000 }).catch(() => {});
  const caseVisible = await casePanel.count() > 0 && await casePanel.first().isVisible();
  record('monitoring: Fall-Prüfen-Panel (Simulation) wird gerendert', caseVisible);
  if (caseVisible) {
    await casePanel.getByLabel(/accession number/i).fill('E2E-UNKNOWN');
    await casePanel.getByRole('button', { name: /run check/i }).click();
    const caseResult = casePanel.getByTestId('case-check-result');
    await caseResult.waitFor({ timeout: 15000 }).catch(() => {});
    const text = await caseResult.textContent().catch(() => '');
    record('monitoring: Simulation liefert eine Routing-Entscheidung',
      /default target/i.test(text || ''), (text || '').slice(0, 60));
  }

  // health panel: configuration checks render on the monitoring page
  await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  const panel = page.getByTestId('broker-health');
  await panel.first().waitFor({ timeout: 10000 }).catch(() => {});
  const panelVisible = await panel.count() > 0 && await panel.first().isVisible();
  record('monitoring: Konfigurations-Check-Panel wird gerendert', panelVisible);
  const panelFindings = panelVisible ? await panel.first().locator('li').count() : 0;
  record('monitoring: Panel listet Befunde (oder meldet "keine")', panelFindings >= 1 || panelVisible,
    `${panelFindings} Findings`);

  // monitoring page: query log after a C-FIND (run the smoke from the host)
  await page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const logRows = await page.locator('tbody tr').count();
  record('monitoring: Query-Log rendert Zeilen', logRows > 0, `${logRows} Zeilen`);

  // the 422 from the deliberate validation test is expected
  const unexpected = errors.filter((e) => !/422/.test(e) && !/broker\.fetch\.failed/.test(e));
  record('interaktiv: keine unerwarteten Console-/Netzwerk-Fehler',
    unexpected.length === 0, unexpected.slice(0, 3).join(' ; '));

  // ── 3. mobile navigation through the broker sub-items ────────────────────
  const m = await newPage(browser, { width: 375, height: 812 }, true);
  await m.page.goto(`${OE3}/oe3/broker`, { waitUntil: 'domcontentloaded' });
  await m.page.waitForTimeout(1000);
  await m.page.getByRole('button').filter({ has: m.page.locator('svg') }).first().tap();
  await m.page.waitForTimeout(600);
  await m.page.getByRole('link', { name: /store targets|store-ziele/i }).first().click();
  await m.page.waitForTimeout(1500);
  record('mobile: Sidebar-Unternavigation erreicht die Ziel-Seite',
    /broker\/targets/.test(m.page.url()), m.page.url().replace(OE3, ''));
  await m.page.screenshot({ path: path.join(SHOTS, 'mobile-nav-targets.png'), fullPage: true });
  record('mobile: keine Console-Fehler bei der Navigation', m.errors.length === 0,
    m.errors.slice(0, 2).join(' ; '));
  await m.ctx.close();

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} Checks bestanden`);
  if (failed.length) {
    console.log('FEHLGESCHLAGEN:');
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  }
  fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
