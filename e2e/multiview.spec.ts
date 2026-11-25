import { expect, test } from '@playwright/test';
import { syntheticFrame } from '../tests/multiview-fixture';

test.skip(
  process.env.CONTOURSTITCH_PROGRESSIVE_ENGINE !== '1',
  'Requires the progressive preview flag',
);

test('collects partial observations across turns and reviews only acquired measurements', async ({
  page,
}) => {
  await page.addInitScript({
    content: `
    const renderFrame = (${syntheticFrame.toString()});
    const body = { height: 174, chest: [42, 28], waist: [35, 25], hip: [41, 29] };
    let timestamp = 0;
    window.progressivePhase = 'partial';
    window.__scanTestFrame = () => {
      timestamp += 510;
      const phase = window.progressivePhase;
      return renderFrame(body, phase === 'side' ? -90 : 0, {
        timestamp,
        crop: phase === 'scale' ? undefined : 'upper',
        zoom: phase === 'scale' ? 1 : 1.4
      });
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: {
      getUserMedia: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        const timer = setInterval(() => context.fillRect(0, 0, 256, 256), 55);
        const stream = canvas.captureStream(16);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(timer);
            stop();
            window.progressiveTrackStopped = true;
          };
        }
        return stream;
      }
    }});
  `,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/measure');
  await expect(
    page.getByRole('heading', { name: 'Camera-Based Measurement' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /experimental measurement engines/i }),
  ).toHaveCount(0);
  await page
    .getByRole('checkbox', { name: /^I agree to the Body Measurement Consent/ })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  const workerReady = page.waitForEvent('worker');
  await page.getByRole('button', { name: /Start guided video/ }).click();
  await workerReady;

  const chest = page
    .locator('.live-estimate')
    .filter({ hasText: 'Chest circumference' });
  const progress = page.getByRole('progressbar', {
    name: 'Camera measurements acquired',
  });
  await expect(page.locator('.live-progress')).toHaveCount(0);
  await expect(chest).toHaveClass(/is-measuring/, {
    timeout: 12_000,
  });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await page.getByText('Development diagnostics').click();
  await expect(
    page.getByText(/Chest circumference · [3-5] frames · 1 angles/),
  ).toBeVisible();
  await page.evaluate(() => Reflect.set(window, 'progressivePhase', 'side'));
  await expect(
    page.getByText(/Step back until your head and feet/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Chest circumference .* 2 angles · 100% coverage/),
  ).toBeVisible({
    timeout: 12_000,
  });
  await page.evaluate(() => Reflect.set(window, 'progressivePhase', 'scale'));
  await expect(chest.getByRole('progressbar')).toBeVisible({
    timeout: 12_000,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  // The existing repeatability floor for this circumference is above the precision target.
  await expect(chest.getByRole('progressbar')).not.toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(
    chest.getByRole('img', { name: 'Camera measurement acquired' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Review measurements' }).click();
  await expect(page).toHaveURL(/\/results$/);
  expect(
    await page.evaluate(() => Reflect.get(window, 'progressiveTrackStopped')),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Edit Chest circumference' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enter Inseam' }),
  ).toBeVisible();
});
