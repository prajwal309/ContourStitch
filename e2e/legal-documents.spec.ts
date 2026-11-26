import { expect, test } from '@playwright/test';

const activeDocuments = [
  { slug: 'terms', title: 'Terms of Service', version: '2' },
  { slug: 'privacy', title: 'Privacy Policy', version: '6' },
  {
    slug: 'body-measurement-policy',
    title: 'Body Measurement Consent & Accuracy Policy',
    version: '1',
  },
  {
    slug: 'measurement-data-improvement',
    title: 'Optional Measurement Data Use',
    version: '2',
  },
] as const;

test('serves versioned draft legal documents with dates and cross-links', async ({
  page,
}) => {
  for (const document of activeDocuments) {
    await page.goto(`/legal/${document.slug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: document.title }),
    ).toBeVisible();
    await expect(page.locator('.legal-version')).toContainText(
      `Version ${document.version}`,
    );
    await expect(page.locator('.legal-version time')).toHaveAttribute(
      'dateTime',
      ['privacy', 'body-measurement-policy'].includes(document.slug)
        ? '2026-11-25'
        : '2026-11-24',
    );
    await expect(page.locator('.legal-version')).toContainText(
      'Draft pending legal review',
    );
    await expect(page.locator('.legal-document section h2').first()).toHaveText(
      /^\d+\./,
    );

    const expected = activeDocuments
      .filter(({ slug }) => slug !== document.slug)
      .map(({ slug, version }) => `/legal/${slug}/${version}`);
    const links = page
      .getByRole('navigation', { name: 'Other legal documents' })
      .getByRole('link');
    expect(
      await links.evaluateAll((items) =>
        items.map((item) => item.getAttribute('href')),
      ),
    ).toEqual(expected);
  }

  await page.goto('/legal/privacy/2');
  await expect(page.locator('.legal-version')).toContainText(
    'date not recorded for this archived revision',
  );
  await expect(page.locator('.legal-version')).toContainText(
    'Draft pending legal review',
  );
});

test('redirects old entry points and keeps the versioned agreements readable', async ({
  page,
}) => {
  for (const slug of ['body-measurement-consent', 'measurement-accuracy']) {
    await page.goto(`/legal/${slug}`);
    await expect(page).toHaveURL(/body-measurement-policy\/1$/);
    await page.goto(`/legal/${slug}/3`);
    await expect(page.locator('.legal-version')).toContainText('Version 3');
    await expect(
      page
        .getByRole('navigation', { name: 'Other legal documents' })
        .getByRole('link', {
          name: 'Body Measurement Consent & Accuracy Policy',
        }),
    ).toBeVisible();
  }
});
