import { expect, test, type Page } from '@playwright/test';
import { liveFrame } from '../tests/live-fixture';

async function installCameraMock(page: Page) {
  await page.addInitScript({
    content: `
    const frame = (${liveFrame.toString()});
    let poseTime = 0;
    window.__liveScanTestMode = 'normal';
    window.__spokenInstructions = [];
    class TestUtterance { constructor(text) { this.text = text; } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: TestUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ name: 'Test English', lang: 'en-US', voiceURI: 'test-en', default: true }],
      speak: utterance => { window.__spokenInstructions.push(utterance.text); utterance.onstart?.(new Event('start')); },
      cancel: () => {}
    }});
    window.__confirmationTones = 0;
    class TestAudioContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          start: () => { window.__confirmationTones += 1; },
          stop() {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: TestAudioContext });
    window.__scanTestFrame = () => {
      const count = document.querySelector('.live-progress')?.getAttribute('aria-label')?.match(/Pose (\\d+) of/);
      if (!count) return frame('front', performance.now());
      const pose = Number(count[1]);
      poseTime += pose === 1 ? 100 : 250;
      const mode = window.__liveScanTestMode;
      const selectedPose = mode === 'wrong-orientation'
        ? 'side'
        : mode === 'poor-visibility'
          ? 'front'
          : ['front','extended','side','back','neck'][pose - 1];
      const sample = frame(selectedPose, poseTime);
      if (mode === 'poor-visibility') sample.landmarks[15].visibility = 0.1;
      return sample;
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
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
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
    await page
      .locator('.live-estimates')
      .evaluate((element) => getComputedStyle(element).overflowY),
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
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(2);
  expect(
    await page
      .locator('.live-estimates')
      .evaluate((element) => getComputedStyle(element).overflowY),
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
  await expect(shoulder.locator('.live-source-indicator')).toHaveClass(
    /is-empty/,
  );
  await expect(
    page.getByText(
      'Height-based population references · camera observations have not started.',
    ),
  ).toBeVisible();
  await expect(inseam.locator('.live-measurement-value')).toHaveText(/^\d+cm$/);
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
  await expect(shoulder.locator('.live-source-indicator')).not.toHaveClass(
    /is-empty/,
  );
  await expect(shoulder.locator('.live-uncertainty')).toHaveAttribute(
    'aria-label',
    /not a validated personal accuracy range/,
  );
  await expect(sleeve.locator('.live-estimate-accessible-state')).toContainText(
    'Refining',
  );
  await expect(sleeve.locator('.live-measurement-value')).toHaveText(/^\d+cm$/);
  await expect(
    page.getByRole('heading', {
      name: 'All required measurements acquired. Thank you.',
    }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole('progressbar', { name: 'Camera measurements acquired' }),
  ).toHaveAttribute('aria-valuenow', '7');
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

test('gives corrective guidance and confirms only accepted camera measurements', async ({
  page,
}) => {
  await installCameraMock(page);
  await page.goto('/measure');
  await page
    .getByRole('checkbox', { name: /I consent to camera-based/ })
    .check();
  await page
    .getByRole('checkbox', { name: /measurements are estimates/ })
    .check();
  await page.getByRole('button', { name: /Continue privately/ }).click();
  await page.evaluate(() => {
    (window as Window & { __liveScanTestMode?: string }).__liveScanTestMode =
      'wrong-orientation';
  });
  await page.getByRole('button', { name: /Start guided video/ }).click();

  const instruction = page.locator('.scan-instruction');
  await expect(instruction).toHaveText(
    'Turn slightly to your left until you face the camera.',
  );
  const progress = page.getByRole('progressbar', {
    name: 'Camera measurements acquired',
  });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await page.evaluate(() => {
    (window as Window & { __liveScanTestMode?: string }).__liveScanTestMode =
      'poor-visibility';
  });
  await expect(instruction).toHaveText(
    'Move your arms slightly away from your body.',
  );
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await page.evaluate(() => {
    (window as Window & { __liveScanTestMode?: string }).__liveScanTestMode =
      'normal';
  });
  await expect(progress).toHaveAttribute('aria-valuenow', '2', {
    timeout: 15_000,
  });
  await expect(progress).toHaveAttribute(
    'aria-valuetext',
    '2 of 7 camera-supported measurements acquired (29 percent)',
  );
  const shoulder = page
    .locator('.live-estimate-grid > div')
    .filter({ has: page.getByText('Shoulder breadth', { exact: true }) });
  await expect(shoulder).toHaveClass(/is-updated/);
  await expect(shoulder.locator('.live-acquired-check')).toHaveAttribute(
    'aria-label',
    'Camera measurement acquired',
  );
  const spokenInstructions = await page.evaluate(
    () =>
      (window as Window & { __spokenInstructions?: string[] })
        .__spokenInstructions ?? [],
  );
  expect(spokenInstructions).toEqual(
    expect.arrayContaining([
      expect.stringContaining(
        'Shoulder breadth and sleeve length measurements have been acquired',
      ),
    ]),
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __confirmationTones?: number })
          .__confirmationTones ?? 0,
    ),
  ).toBeGreaterThan(0);
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
  await expect(page.locator('.scan-instruction')).toHaveText(
    'Stand in front of the camera. Make sure only you are in view.',
    { timeout: 20_000 },
  );
  await expect(
    page.getByText(
      'Height-based population references · no camera evidence yet.',
    ),
  ).toBeVisible();
  await expect(
    page.locator('.live-estimate-grid .live-measurement-value').first(),
  ).toHaveText(/^\d+cm$/);
  await expect(
    page.getByRole('heading', { name: 'Scan complete' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('progressbar', { name: 'Camera measurements acquired' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await page
    .getByRole('button', { name: 'Enter tape measurements instead' })
    .click();
  await expect(page.getByText('0 of 7 measurements')).toBeVisible();
});
