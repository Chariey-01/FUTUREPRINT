import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // Google Fonts may be unreachable in CI/sandboxes; that's not an app error.
    if (msg.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(msg.text()))
      errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function expectA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Click the visible card, as a visitor would (the radio inside it is visually hidden). */
async function pick(page: Page, label: RegExp) {
  await page.getByTestId('decision-card').filter({ hasText: label }).click();
  await expect(page.getByRole('radio', { name: label })).toBeChecked();
}

async function decide(page: Page, label: RegExp) {
  await pick(page, label);
  await page.getByRole('button', { name: /lock in/i }).click();
}

test('full visitor journey: Portal → Begin → Occupation → 3 decisions → Report, with refresh', async ({
  page,
}) => {
  const errors = trackConsoleErrors(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Explore the work that’s changing',
  );
  await expectA11y(page);
  await page.getByRole('link', { name: /begin/i }).first().click();

  await expect(page).toHaveURL(/\/start$/);
  await page.getByRole('button', { name: /graphic designer/i }).click();

  await expect(page).toHaveURL(/\/simulate$/);
  await expect(page.getByTestId('step-label')).toHaveText('Chapter 1 of 3');
  await expectA11y(page);
  await decide(page, /redesign the work/i);
  await expect(page.getByTestId('step-label')).toHaveText('Chapter 2 of 3');

  // Refresh mid-journey: resumes the same step.
  await page.reload();
  await expect(page.getByTestId('step-label')).toHaveText('Chapter 2 of 3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your pilot works');

  await decide(page, /lead the change/i);
  await expect(page.getByTestId('step-label')).toHaveText('Chapter 3 of 3');
  await decide(page, /architect of new work/i);

  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Transform pathway');
  await expect(
    page
      .getByRole('region', { name: /evidence behind your future/i })
      .getByRole('link')
      .first(),
  ).toHaveAttribute('href', /^https:\/\//);
  await expectA11y(page);

  // Session token never appears in the URL.
  expect(page.url()).not.toMatch(/tok/);
  expect(errors).toEqual([]);
});

const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`responsive @ ${vp.width}px: no overflow, screenshots of every screen`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-1-portal.png` });

    await page.goto('/start');
    await expect(page.getByRole('button', { name: /accountant/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-2-occupations.png`, fullPage: true });

    await page.getByRole('button', { name: /accountant/i }).click();
    await pick(page, /master the tool/i);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-3-simulator.png`, fullPage: true });

    await page.getByRole('button', { name: /lock in/i }).click();
    await decide(page, /deepen your craft/i);
    await decide(page, /trusted expert/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Adapt pathway');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-4-report.png`, fullPage: true });
  });
}

test('keyboard-only: complete a decision without a mouse', async ({ page }) => {
  await page.goto('/start');
  await page.getByRole('button', { name: /registered nurse/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-label')).toHaveText('Chapter 1 of 3');
  await page.getByRole('radio').first().focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /lock in/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-label')).toHaveText('Chapter 2 of 3');
});
