import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser } from '@playwright/test';

const PAGES = ['/observatory', '/occupations/nurse', '/methodology', '/signin'];

for (const path of PAGES) {
  test(`a11y + no overflow at 360px: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
    ).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('mobile menu opens, exposes links and closes on navigation', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/start');
  const toggle = page.getByRole('button', { name: 'Menu' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('navigation', { name: 'Main menu' })
    .getByRole('link', { name: 'Sign in' })
    .click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

/** One cold load (fresh context = empty browser cache) under the Lighthouse "Slow 4G" profile. */
async function measureLcp(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // 150ms RTT, 1.6 Mbps down, 750 Kbps up, 4x CPU slowdown.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(baseURL, { waitUntil: 'load' });
  const lcp = await page.evaluate(
    () =>
      new Promise<{ time: number; element: string }>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as (PerformanceEntry & { element?: Element })[];
          const last = entries[entries.length - 1]!;
          resolve({
            time: last.startTime,
            element: last.element ? `${last.element.tagName}#${last.element.id}` : 'unknown',
          });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }),
  );
  await context.close();
  return lcp;
}

test('portal LCP on throttled 4G: median of 3 cold loads under 2.5s', async ({
  browser,
  browserName,
  request,
  baseURL,
}) => {
  test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only');
  test.setTimeout(120_000);
  // Warm the preview *server* (disk cache), not the browser: each run uses an empty cache.
  await request.get('/');
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await measureLcp(browser, baseURL!));
  const times = runs.map((r) => Math.round(r.time)).sort((a, b) => a - b);
  const median = times[1]!;
  const summary = `LCP slow 4G + 4x CPU, cold cache: runs ${times.join(' / ')} ms, median ${median} ms on ${runs[0]!.element}`;
  test.info().annotations.push({ type: 'performance', description: summary });
  process.stdout.write(`${summary}\n`);
  expect(median).toBeLessThan(2500);
});
