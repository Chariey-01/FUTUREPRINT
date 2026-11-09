// End-to-end smoke test of the frontend against the REAL Flask API (real engine + seed data).
// Prereqs: scripts/real-backend-docker.sh, then the client in real mode on WEB (default :6174):
//   VITE_USE_MOCKS=false VITE_API_BASE_URL=http://localhost:5055 npx vite --port 6174
// Usage: node scripts/real-api-smoke.mjs [screenshotDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const WEB = process.env.WEB ?? 'http://localhost:6174';
const API = process.env.API ?? 'http://localhost:5055';
const out = process.argv[2] ?? 'real-api-shots';
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);
const errors = [];
const apiCalls = new Set();
const fail = (msg) => {
  throw new Error(`SMOKE FAILED: ${msg}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(60_000);
page.on('console', (m) => {
  if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.url().includes('/api/v1/'))
    apiCalls.add(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
});

// 1. Real occupations; no mock badge.
await page.goto(`${WEB}/start`, { waitUntil: 'networkidle' });
if (await page.getByTestId('mock-mode-badge').count()) fail('mock mode is on');
const cards = page.locator('main ul > li button');
await cards.first().waitFor();
log('occupations:', await cards.count());
await page.screenshot({ path: `${out}/1-occupations.png`, fullPage: true });

// 2. Decide until the report, refreshing once mid-journey.
await cards.first().click();
await page.waitForURL('**/simulate');
const label = page.getByTestId('step-label');
await label.waitFor();
log(
  'first step:',
  (await label.textContent())?.trim(),
  '|',
  (await page.locator('h1').textContent())?.trim(),
);
await page.screenshot({ path: `${out}/2-simulator.png`, fullPage: true });
for (let step = 1; !page.url().endsWith('/report'); step++) {
  if (step > 12) fail('too many steps');
  const before = await label.textContent();
  await page.getByTestId('decision-card').first().click();
  await page.getByRole('button', { name: /lock in/i }).click();
  await page.waitForFunction(
    (prev) =>
      location.pathname.endsWith('/report') ||
      document.querySelector('[data-testid="step-label"]')?.textContent !== prev,
    before,
  );
  if (page.url().endsWith('/report')) break;
  log(`after step ${step}:`, (await label.textContent())?.trim());
  if (step === 1) {
    await page.reload();
    await label.waitFor();
    if ((await label.textContent()) === before) fail('refresh did not resume');
    log('refresh resumed at:', (await label.textContent())?.trim());
  }
}

// 3. Report.
await page.locator('h1').waitFor();
log('report:', (await page.locator('h1').textContent())?.trim());
if (!(await page.getByRole('complementary', { name: /about this report/i }).count()))
  fail('disclaimer missing');
const research = page.getByRole('region', { name: /evidence behind your future/i });
log('research links:', await research.getByRole('link').count());
const reasoned = page
  .getByRole('region', { name: /where you could go next/i })
  .getByTestId('reasoned-item');
const withWhy = await reasoned.evaluateAll(
  (els) => els.filter((e) => /Why:/.test(e.textContent ?? '')).length,
);
if (withWhy !== (await reasoned.count())) fail('a suggestion is missing its reason');
log('reasoned items with Why:', withWhy);
await page.screenshot({ path: `${out}/3-report.png`, fullPage: true });

// 4. Shared report in a fresh context (no session).
const token = await page.evaluate(async (api) => {
  const t = sessionStorage.getItem('futureprint.sessionToken');
  const r = await fetch(`${api}/api/v1/sessions/current/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
  });
  return (await r.json()).share_token;
}, API);
const shared = await (await browser.newContext()).newPage();
await shared.goto(`${WEB}/r/${token}`, { waitUntil: 'networkidle' });
if (!(await shared.getByText(/a shared futureprint/i).count())) fail('shared report did not open');
log('shared report: ok');

// 5. Research pages.
await page.goto(`${WEB}/observatory`, { waitUntil: 'networkidle' });
log('observatory events:', await page.locator('main h4').count());
await page.goto(`${WEB}/occupations/software-developer`, { waitUntil: 'networkidle' });
log('task scanner tasks:', await page.locator('#tasks-heading ~ ul > li').count());

log('API calls:', [...apiCalls].join(' | '));
if (errors.length) fail(`console errors: ${errors.join(' | ')}`);
log('SMOKE PASSED');
await browser.close();
