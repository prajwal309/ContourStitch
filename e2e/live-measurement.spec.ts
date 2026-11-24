import { expect, test } from '@playwright/test';
import { liveFrame } from '../tests/live-fixture';

test('guides five poses on device, stops the camera, and saves a corrected result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript({
    content: `
    const frame = (${liveFrame.toString()});
    let poseTime = 0;
    window.__scanTestFrame = () => {
      const count = document.querySelector('.live-progress')?.getAttribute('aria-label')?.match(/Pose (\\d+) of/);
      if (!count) return frame('front', performance.now());
      const pose = Number(count[1]);
      poseTime += pose === 1 ? 100 : 250;
      return frame(['front','extended','side','back','neck'][pose - 1], poseTime);
    };
    Object.defineProperty(navigator, 'mediaDevices', {value: {
      getUserMedia: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 400;
        const context = canvas.getContext('2d');
        const paint = () => context.fillRect(0, 0, 320, 400);
        paint();
        const stream = canvas.captureStream(10);
        const timer = setInterval(paint, 100);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { stop(); clearInterval(timer); window.liveCameraStopped = true; };
        }
        return stream;
      }
    }});
  `,
  });
  await page.goto('/measure');
  await page
    .getByRole('checkbox', {
      name: 'I agree to browser-side camera processing.',
    })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page
    .getByRole('checkbox', {
      name: 'Add a known-size reference object (optional)',
    })
    .check();
  await page.getByRole('button', { name: /Start guided video/ }).click();
  await page.getByRole('button', { name: 'Capture reference frame' }).click();
  await page.getByLabel('Reference length in centimetres').fill('102');
  await page.getByRole('button', { name: 'Use reference scale' }).click();
  const sleeve = page.locator('.live-estimates dl > div').filter({
    has: page.getByText('Sleeve length', { exact: true }),
  });
  const shoulder = page.locator('.live-estimates dl > div').filter({
    has: page.getByText('Shoulder breadth', { exact: true }),
  });
  await expect(shoulder.getByText('Preliminary estimate')).toBeVisible();
  await expect(shoulder.getByText('No validated interval')).toBeVisible();
  await expect(sleeve.getByText('Preliminary estimate')).toBeVisible();
  await expect(sleeve.getByText(/^\d+ cm$/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Scan complete' }),
  ).toBeVisible({ timeout: 30_000 });
  expect(
    await page.evaluate(
      () =>
        (window as Window & { liveCameraStopped?: boolean }).liveCameraStopped,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Review measurements' }).click();
  await expect(page.getByText('7 of 7 measurements')).toBeVisible();
  await page.getByRole('button', { name: 'Edit Neck circumference' }).click();
  await page.getByLabel('Neck circumference in centimetres').fill('39');
  await page.getByRole('button', { name: 'Apply measurement' }).click();
  await expect(
    page.getByText('Neck circumference updated.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save on this device' }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('contourstitch.profile.v1') ?? 'null'),
  );
  expect(saved.report.estimates).toHaveLength(7);
  expect(
    saved.report.estimates.find(({ key }: { key: string }) => key === 'neck'),
  ).toMatchObject({ valueCm: 39 });
});

test('the real on-device model withholds estimates from a blank camera feed', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 240;
          canvas.height = 320;
          const context = canvas.getContext('2d')!;
          context.fillStyle = '#ddd';
          const stream = canvas.captureStream(8);
          const paint = () =>
            context.fillRect(0, 0, canvas.width, canvas.height);
          const timer = setInterval(paint, 125);
          paint();
          for (const track of stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => {
              clearInterval(timer);
              stop();
            };
          }
          return stream;
        },
      },
    });
  });
  await page.goto('/measure');
  await page
    .getByRole('checkbox', {
      name: 'I agree to browser-side camera processing.',
    })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page.getByRole('button', { name: /Start guided video/ }).click();
  await expect(page.getByText('Keep one person in view.')).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole('heading', { name: 'Scan complete' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Enter tape measurements instead' })
    .click();
  await expect(page.getByText('0 of 7 measurements')).toBeVisible();
});
