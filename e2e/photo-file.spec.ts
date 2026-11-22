import { expect, test } from '@playwright/test';

test('guest can check a local photo after camera denial', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    });
  });

  await page.goto('/measure');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page.getByRole('button', { name: /Continue to photos/ }).click();
  await expect(page.getByText(/permission was denied/)).toBeVisible();
  await page.getByRole('button', { name: 'Use an existing photo' }).click();

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 240;
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('Choose front photo').setInputFiles({
    name: 'blank-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });

  await expect(
    page.getByRole('list', { name: 'Live capture checklist' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Use front photo/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Enter tape measurements instead' }),
  ).toBeVisible();
});
