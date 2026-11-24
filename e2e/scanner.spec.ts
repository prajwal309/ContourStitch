import { test, expect } from '@playwright/test';
for (const debug of [false, true])
  test(`guided mobile scan completes${debug ? ' and runs development ONNX' : ''}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let count = 0;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 400;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#334433';
            ctx.fillRect(0, 0, 200, 400);
            const stream = canvas.captureStream(10);
            const timer = setInterval(() => ctx.fillRect(0, 0, 200, 400), 100);
            stream.getTracks().forEach((track) => {
              const original = track.stop.bind(track);
              track.stop = () => {
                clearInterval(timer);
                original();
                (window as Window & { cameraStopped?: boolean }).cameraStopped =
                  true;
              };
            });
            return stream;
          },
        },
      });
      (window as Window & { __scanTestFrame?: () => unknown }).__scanTestFrame =
        () => {
          count++;
          const angle = count < 16 ? 0 : Math.min(360, (count - 16) * 2);
          const a = (angle * Math.PI) / 180;
          const landmarks = Array.from({ length: 33 }, () => ({
            x: 0.5,
            y: 0.15,
            z: 0,
            visibility: 0.99,
          }));
          const set = (i: number, x: number, y: number, z = 0) => {
            landmarks[i] = { x, y, z, visibility: 0.99 };
          };
          set(0, 0.5, 0.12);
          set(11, 0.5 - 0.2 * Math.cos(a), 0.25, 0.2 * Math.sin(a));
          set(12, 0.5 + 0.2 * Math.cos(a), 0.25, -0.2 * Math.sin(a));
          set(13, 0.23, 0.38);
          set(14, 0.77, 0.38);
          set(15, 0.15, 0.5);
          set(16, 0.85, 0.5);
          set(23, 0.35, 0.53);
          set(24, 0.65, 0.53);
          set(25, 0.4, 0.72);
          set(26, 0.6, 0.72);
          set(27, 0.4, 0.91);
          set(28, 0.6, 0.91);
          set(31, 0.39, 0.93);
          set(32, 0.61, 0.93);
          const data = new Float32Array(200 * 400);
          for (let y = 25; y < 376; y++)
            for (let x = 60; x < 141; x++) data[y * 200 + x] = 1;
          return {
            timestamp: count * 100,
            width: 200,
            height: 400,
            landmarks,
            poseCount: 1,
            mask: { width: 200, height: 400, data },
            brightness: 150,
            sharpness: 150,
          };
        };
    });
    await page.goto(
      debug ? '/measure/experimental?debug=1' : '/measure/experimental',
    );
    if (debug) {
      await page
        .getByRole('radio', {
          name: /Multi-View Silhouette Reconstruction — Beta/,
        })
        .check();
      await page.getByLabel('Silhouette views').selectOption('4');
    }
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await page.getByRole('button', { name: 'Continue to video scan' }).click();
    await expect(
      page.getByRole('heading', { name: 'Scan complete', exact: true }),
    ).toBeVisible({ timeout: 40000 });
    await expect(
      page.getByText('No calibrated uncertainty interval is available.', {
        exact: false,
      }),
    ).toBeVisible();
    if (debug) {
      await expect(
        page.getByRole('heading', {
          name: 'Multi-view silhouette reconstruction',
        }),
      ).toBeVisible();
      await expect(
        page.getByLabel(
          'Interactive voxel surface reconstruction; drag to rotate, or use the arrow keys.',
        ),
      ).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => (window as Window & { cameraStopped?: boolean }).cameraStopped,
      ),
    ).toBe(true);
    if (debug) {
      await page
        .getByRole('button', { name: 'Test optional ONNX model' })
        .click();
      await expect(
        page.getByText('Development prediction only.', { exact: false }),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByText('Extracted scan features', { exact: true }),
      ).toBeVisible();
    } else
      await expect(page.locator('body')).not.toHaveText(
        /Extracted scan features/,
      );
  });
test('permission denial offers restart and closes cleanly', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    }),
  );
  await page.goto('/measure/experimental');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('button', { name: 'Continue to video scan' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'permission was denied',
  );
  await page.getByRole('button', { name: 'Close scanner' }).click();
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeVisible();
});
