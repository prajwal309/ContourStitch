import { expect, test } from '@playwright/test';

const activeDocuments = [
  { slug: 'terms', title: 'Terms of Service', version: '2' },
  { slug: 'privacy', title: 'Privacy Policy', version: '5' },
  {
    slug: 'body-measurement-consent',
    title: 'Body Measurement Consent',
    version: '3',
  },
  {
    slug: 'measurement-accuracy',
    title: 'Measurement Accuracy Disclaimer',
    version: '3',
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
      document.slug === 'privacy' ? '2026-11-25' : '2026-11-24',
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
