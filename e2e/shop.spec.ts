import { expect, test } from '@playwright/test';

test('guest can filter coordinated wedding outfits on a small screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Measure Once.*Wear Everywhere/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Explore Collections' }).click();
  await page.getByLabel('Occasion').selectOption('Wedding');
  await page.getByLabel('Clothing type').selectOption('Kurta');
  await page.getByLabel('Age group').selectOption('Children');
  await page.getByLabel('Color').selectOption('Copper');
  await page.getByLabel('Style').selectOption('Classic');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const outfits = page.getByRole('list', { name: 'Outfits' });
  await expect(outfits.getByRole('listitem')).toHaveCount(1);
  await outfits.getByRole('link', { name: /Junior Heritage Kurta/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Junior Heritage Kurta' }),
  ).toBeVisible();
  await expect(page.getByText('Preferred kurta length')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sign in to use my fit' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
