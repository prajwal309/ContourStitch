import { expect, test } from '@playwright/test';

test('the homepage focuses on measurement while shop routes are paused', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page).toHaveTitle('ContourStitch — One measure. Endless fits.');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'ContourStitch — One measure. Endless fits.',
  );
  await expect(
    page.getByRole('heading', {
      name: 'ContourStitch One measure. Endless fits.',
    }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/shop"]')).toHaveCount(0);
  await expect(page.getByText('The Heritage Wedding Collection')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Create My Fit Profile' }).click();
  await expect(page).toHaveURL(/\/measure$/);
  for (const path of [
    '/shop',
    '/shop/collections/heritage-wedding',
    '/shop/heritage-kurta',
    '/collections/adult-kurta.webp',
    '/collections/adult-lehenga.webp',
    '/collections/child-kurta.webp',
    '/collections/child-dress.webp',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});
