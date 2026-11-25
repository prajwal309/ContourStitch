import { expect, test } from '@playwright/test';
import { agreementPath } from '../lib/consent/agreements';

const destinations = [
  ['Founders', '/founder'],
  ['How It Works', '/#how-it-works'],
  ['My Fit Profile', '/my-measurements'],
  ['Family Fit Studio', '/family-fit'],
  ['Sign In', '/sign-in?next=%2Faccount'],
] as const;

for (const width of [360, 768, 1024, 1440]) {
  test(`landing page fits ${width}px with reachable navigation and an above-fold action`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const primary = page.getByRole('link', { name: 'Find My Fit' });
    await expect(primary).toBeInViewport({ ratio: 1 });
    await expect(primary).toHaveAttribute('href', '/measure');
    await expect(
      page.getByRole('link', { name: 'Camera-Based Measurement' }),
    ).toHaveAttribute('href', '/measure');

    const isMobileMenu = width <= 900;
    if (isMobileMenu) {
      const menu = page
        .getByText('Navigation menu', { exact: true })
        .locator('..');
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('navigation', { name: 'Mobile navigation' }),
      ).toBeVisible();
    }
    const navigation = page.getByRole('navigation', {
      name: isMobileMenu ? 'Mobile navigation' : 'Main navigation',
    });
    for (const [label, href] of destinations) {
      await expect(
        navigation.getByRole('link', { name: label, exact: true }),
      ).toHaveAttribute('href', href);
    }
    if (isMobileMenu) {
      await navigation.getByRole('link', { name: 'How It Works' }).focus();
      await page.keyboard.press('Escape');
      await expect(navigation).toBeHidden();
      await expect(
        page.getByText('Navigation menu', { exact: true }).locator('..'),
      ).toBeFocused();
    }

    await page.getByRole('link', { name: 'See How It Works' }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(
      page.getByRole('heading', { name: 'From camera to fit.' }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test('presents the Digital Fit Passport as a responsive sample card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const section = page.locator('.landing-passport');
  const card = section.locator('.passport-card');
  await expect(
    section.getByRole('heading', { name: 'Digital Fit Passport' }).first(),
  ).toBeVisible();
  await expect(card.getByText('Example profile')).toBeVisible();
  await expect(
    card.getByRole('heading', { name: 'Digital Fit Passport' }),
  ).toBeVisible();
  const mannequin = card.getByRole('img', {
    name: 'Front-view wireframe mannequin with chest, waist and hip measurement rings.',
  });
  await expect(mannequin).toHaveAttribute(
    'src',
    '/models/quaternius-female/passport-front.svg',
  );
  await expect(card.locator('canvas')).toHaveCount(0);
  for (const label of [
    'Chest circumference',
    'Waist circumference',
    'Hip circumference',
  ]) {
    await expect(card.getByText(label, { exact: true })).toBeVisible();
  }
  for (const value of ['90', '73', '97']) {
    await expect(card.getByText(value, { exact: true })).toBeVisible();
  }
  const action = section.getByRole('link', { name: 'View My Fit Passport' });
  await expect(action).toHaveAttribute('href', '/my-measurements');

  for (const width of [1280, 768, 360]) {
    await page.setViewportSize({ width, height: 850 });
    const columnCount = await section
      .locator('.landing-passport-grid')
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
      );
    expect(columnCount).toBe(width <= 699 ? 1 : 2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }

  const description = await section
    .locator('.passport-description')
    .boundingBox();
  const cardBounds = await card.boundingBox();
  const actionBounds = await action.boundingBox();
  expect(description).not.toBeNull();
  expect(cardBounds).not.toBeNull();
  expect(actionBounds).not.toBeNull();
  expect(description!.y + description!.height).toBeLessThan(cardBounds!.y);
  expect(cardBounds!.y + cardBounds!.height).toBeLessThan(actionBounds!.y);
});

test('uses the supplied hero image and removes the family photo', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByAltText(
      'A tailor measuring a wireframe mannequin with a tape measure',
    ),
  ).toBeVisible();
  await expect(page.locator('.landing-hero-art figcaption')).toHaveCount(0);
  await expect(
    page.getByAltText(
      'Family members adjusting an embroidered bridal outfit at a fitting',
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Family fittings', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Confirm with a tape', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', {
      name: 'Wedding and family fittings',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('front preview loads a licensed 3D mannequin without overlay buttons', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const assetLoaded = page.waitForResponse((response) =>
    response.url().endsWith('/models/quaternius-female/mannequin-v1.bin'),
  );
  await page.goto('/');
  const preview = page.getByRole('region', {
    name: 'See how a scan takes shape.',
  });
  await expect(preview.getByText(/3D mannequin/)).toBeVisible();
  await expect(
    preview.getByRole('group', {
      name: 'Rotating illustrative 3D human body mesh',
    }),
  ).toBeVisible();
  await expect(
    preview.getByText('Illustrative, not your measurement result'),
  ).toHaveCount(0);
  await expect(
    preview.getByRole('link', { name: 'Quaternius · CC0' }),
  ).toHaveCount(0);
  const assetResponse = await assetLoaded;
  expect(assetResponse.ok()).toBe(true);
  expect((await assetResponse.body()).byteLength).toBeLessThan(100_000);
  await expect(preview.locator('canvas')).toBeVisible();
  const meshPreview = preview.locator('.body-mesh-preview');
  await expect(meshPreview.getByRole('button')).toHaveCount(0);
  await expect(
    meshPreview.getByText('Measurements', { exact: true }),
  ).toHaveCount(0);
  await expect(preview.locator('svg.scan-silhouette')).toHaveCount(0);
});

test('3D mannequin follows the measurement timeline without drag controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const preview = page.getByRole('region', {
    name: 'See how a scan takes shape.',
  });
  const canvas = page.locator('.body-mesh-preview canvas');
  await expect(canvas).toBeVisible();
  const demo = preview.locator('.landing-demo');
  const editor = preview.locator('.demo-editor');
  const stageContainer = preview.locator('.demo-stage');
  const documentBounds = (element: import('@playwright/test').Locator) =>
    element.evaluate((node) => {
      const { top, left, width, height } = node.getBoundingClientRect();
      return {
        top: top + window.scrollY,
        left: left + window.scrollX,
        width,
        height,
      };
    });
  const demoBounds = await documentBounds(demo);
  const stageBounds = await documentBounds(stageContainer);
  const initialStage = await editor.getAttribute('data-stage');
  const firstFrame = await canvas.screenshot();
  await page.waitForTimeout(5200);
  const nextStage = await editor.getAttribute('data-stage');
  expect(nextStage).not.toBe(initialStage);
  expect(['front', 'side', 'review', 'results']).toContain(nextStage);
  await expect(
    preview.getByRole('heading', {
      name: /Front View|Side View|Review|Measurement Results/,
    }),
  ).toBeVisible();
  expect(await documentBounds(demo)).toEqual(demoBounds);
  expect(await documentBounds(stageContainer)).toEqual(stageBounds);
  const secondFrame = await canvas.screenshot();
  expect(firstFrame.equals(secondFrame)).toBe(false);
});

test('the sample measurement demo starts at the front stage and keeps user flows reachable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const preview = page.getByRole('region', {
    name: 'See how a scan takes shape.',
  });
  await expect(
    preview.getByRole('heading', { name: 'Front View', exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole('progressbar', { name: '16-second demo cycle' }),
  ).toBeVisible();
  await expect(
    preview.getByText('Illustrative sample measurements'),
  ).toBeVisible();
  await expect(preview.getByText('Demo', { exact: true })).toBeVisible();
  await expect(
    preview.getByText('Shoulder breadth', { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator('.landing-reveal')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');

  const mainLinks = [
    ['Open Family Fit Studio', '/family-fit'],
    ['View My Fit Passport', '/my-measurements'],
    ['Enter Measurements Manually', '/results'],
    ['Read the Privacy Policy', agreementPath('PRIVACY')],
  ] as const;
  for (const [label, href] of mainLinks) {
    await expect(
      page.getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('href', href);
  }
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Founders' })).toHaveAttribute(
    'href',
    '/founder',
  );
  await expect(
    footer.getByRole('link', { name: 'Contact & feedback' }),
  ).toHaveAttribute(
    'href',
    'https://github.com/prajwal309/ContourStitch/issues',
  );
  await expect(
    footer.getByRole('link', { name: 'Terms of Service' }),
  ).toHaveAttribute('href', agreementPath('TERMS'));
  await expect(
    footer.getByRole('link', { name: 'Privacy Policy' }),
  ).toHaveAttribute('href', agreementPath('PRIVACY'));
  for (const href of [
    '/family-fit',
    '/my-measurements',
    '/results',
    '/founder',
    agreementPath('TERMS'),
    agreementPath('PRIVACY'),
    '/sign-in?next=%2Faccount',
  ]) {
    expect((await page.request.get(href)).ok()).toBe(true);
  }
});
