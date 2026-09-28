import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('home screen shows the main actions', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Crusty Krustees');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you need?');
    for (const label of [
      'New customer',
      'Report incident',
      'Customer check',
      'My incidents',
      'Alerts',
    ]) {
      await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }
  });

  test('has no automatically detectable accessibility problems', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('never scrolls sideways on a phone', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('deep links work after a refresh', async ({ page }) => {
    await page.goto('/incidents');
    await expect(page.getByRole('heading', { name: 'My incidents' })).toBeVisible();
  });
});

test.describe('installable PWA', () => {
  test('links a valid web app manifest', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifest = await (await request.get(`/${href!.replace(/^\//, '')}`)).json();
    expect(manifest).toMatchObject({
      name: 'Crusty Krustees',
      short_name: 'Krustees',
      display: 'standalone',
      start_url: '/',
    });
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });

  test('every manifest icon actually exists', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(`/${icon.src}`);
      expect(response.status(), icon.src).toBe(200);
    }
  });

  test('registers a service worker so the app works offline', async ({ page }) => {
    await page.goto('/');
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(scope).toMatch(/\/$/);
  });

  test('opens the app shell while offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Reload once so the service worker controls the page.
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you need?');
  });
});
