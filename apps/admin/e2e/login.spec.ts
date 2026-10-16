import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('admin panel, signed out', () => {
  test('shows the sign-in page without errors', async ({ page }) => {
    // Regression: a theme setting once sent react-admin into an endless
    // re-render ("Maximum update depth exceeded") and left this page blank.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

    const loopErrors = errors.filter((e) => /Maximum update depth|Uncaught/i.test(e));
    expect(loopErrors).toEqual([]);
  });

  test('has no automatically detectable accessibility problems', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('is hidden from search engines', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
