import { expect, test, type Page } from '@playwright/test';
import { liveFrame } from '../tests/live-fixture';

async function installCameraMock(page: Page) {
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
}

test('keeps camera and accuracy agreement links inline on a wide consent page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/measure');

  const agreements = [
    [
      'I consent to camera-based body measurement processing.',
      /^Body Measurement Consent/,
    ],
    [
      'I understand that measurements are estimates and may contain errors.',
      /^Measurement Accuracy Disclaimer/,
    ],
  ] as const;

  for (const [label, linkName] of agreements) {
    const labelBounds = await page.getByLabel(label).boundingBox();
    const linkBounds = await page
      .getByRole('link', { name: linkName })
      .boundingBox();
    expect(labelBounds).not.toBeNull();
    expect(linkBounds).not.toBeNull();
    expect(Math.abs(linkBounds!.y - labelBounds!.y)).toBeLessThan(3);
  }
});

test('shows all nine estimates in a 3 by 3 desktop dashboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installCameraMock(page);
  await page.goto('/measure');
  await page
    .getByRole('checkbox', { name: /I consent to camera-based/ })
    .check();
  await page
    .getByRole('checkbox', { name: /measurements are estimates/ })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page.getByRole('button', { name: /Start guided video/ }).click();

  const grid = page.locator('.live-estimate-grid');
  await expect(grid.locator(':scope > div')).toHaveCount(9);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(3);
  expect(
    await grid.evaluate((element) => {
      const { top } = element.getBoundingClientRect();
      const tileRects = [...element.children].map((tile) =>
        tile.getBoundingClientRect(),
      );
      return (
        top >= 0 &&
        tileRects.every((tile) => tile.top >= 0 && tile.bottom <= innerHeight)
      );
    }),
  ).toBe(true);
  expect(
    await page.locator('.live-estimates').evaluate(
      (element) => getComputedStyle(element).overflowY,
    ),
  ).toBe('visible');
});

test('guides five poses on device, stops the camera, and saves a corrected result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await installCameraMock(page);
  await page.goto('/measure');
  await page
    .getByRole('checkbox', {
      name: /I consent to camera-based/,
    })
    .check();
  await page
    .getByRole('checkbox', { name: /measurements are estimates/ })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page
    .getByRole('checkbox', {
      name: 'Add a known-size reference object (optional)',
    })
    .check();
  await page.getByRole('button', { name: /Start guided video/ }).click();
  await page.getByRole('button', { name: 'Capture reference frame' }).click();
  const grid = page.locator('.live-estimate-grid');
  const tiles = grid.locator(':scope > div');
  await expect(tiles).toHaveCount(9);
  expect(
    await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(2);
  expect(
    await page.locator('.live-estimates').evaluate(
      (element) => getComputedStyle(element).overflowY,
    ),
  ).toBe('visible');
  const shoulder = grid.locator('> div').filter({
    has: page.getByText('Shoulder breadth', { exact: true }),
  });
  const inseam = grid.locator('> div').filter({
    has: page.getByText('Inseam', { exact: true }),
  });
  await expect(shoulder.locator('.live-measurement-value')).toHaveText(
    /^\d+cm$/,
  );
  await expect(
    shoulder.locator('.live-source-indicator'),
  ).toHaveClass(/is-empty/);
  await expect(
    page.getByText(
      'Height-based population references · camera observations have not started.',
    ),
  ).toBeVisible();
  await expect(inseam.locator('.live-measurement-value')).toHaveText(
    /^\d+cm$/,
  );
  await page.getByLabel('Reference length in centimetres').fill('102');
  await page.getByRole('button', { name: 'Use reference scale' }).click();
  const sleeve = grid.locator('> div').filter({
    has: page.getByText('Sleeve length', { exact: true }),
  });
  await expect(
    page.getByRole('button', { name: 'Disable voice guidance' }),
  ).toBeVisible();
  await expect(
    shoulder.locator('.live-estimate-accessible-state'),
  ).toContainText('Refining');
  await expect(
    shoulder.locator('.live-source-indicator'),
  ).not.toHaveClass(/is-empty/);
  await expect(shoulder.locator('.live-uncertainty')).toHaveAttribute(
    'aria-label',
    /not a validated personal accuracy range/,
  );
  await expect(
    sleeve.locator('.live-estimate-accessible-state'),
  ).toContainText('Refining');
  await expect(sleeve.locator('.live-measurement-value')).toHaveText(
    /^\d+cm$/,
  );
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
      name: /I consent to camera-based/,
    })
    .check();
  await page
    .getByRole('checkbox', { name: /measurements are estimates/ })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page.getByRole('button', { name: /Start guided video/ }).click();
  await expect(page.locator('p.live-feedback')).toHaveText(
    'Keep one person in view.',
    { timeout: 20_000 },
  );
  await expect(
    page.getByText('Height-based population references · no camera evidence yet.'),
  ).toBeVisible();
  await expect(
    page.locator('.live-estimate-grid .live-measurement-value').first(),
  ).toHaveText(/^\d+cm$/);
  await expect(
    page.getByRole('heading', { name: 'Scan complete' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Enter tape measurements instead' })
    .click();
  await expect(page.getByText('0 of 7 measurements')).toBeVisible();
});
