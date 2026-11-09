// Visual QA helper: screenshots routes at 360 / 768 / 1440 px.
// Usage: node scripts/shoot.mjs <baseUrl> <outDir> <route>[,<route>...] [--full] [--menu]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [base = 'http://localhost:6173', out = 'qa-shots', routeArg = '/', ...flags] =
  process.argv.slice(2);
const full = flags.includes('--full');
const menu = flags.includes('--menu');
const widths = [
  ['mobile', 360, 780],
  ['tablet', 768, 1024],
  ['desktop', 1440, 900],
];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const route of routeArg.split(',')) {
  for (const [name, width, height] of widths) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    if (menu && width < 768) await page.getByRole('button', { name: 'Menu' }).click();
    const slug = route === '/' ? 'portal' : route.replace(/\W+/g, '-').replace(/^-|-$/g, '');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.screenshot({
      path: `${out}/${name}-${slug}${menu ? '-menu' : ''}.png`,
      fullPage: full,
    });
    console.log(`${name} ${route} overflow=${overflow}`);
    await page.close();
  }
}
await browser.close();
