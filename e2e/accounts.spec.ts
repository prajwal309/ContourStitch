import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.CONTOURSTITCH_TEST_DATABASE_URL;

async function enterWaist(page: Page, value: number, mode: 'Enter' | 'Edit') {
  await page
    .getByRole('button', { name: `${mode} Waist circumference` })
    .click();
  await page
    .getByLabel('Waist circumference in centimetres')
    .fill(String(value));
  await page.getByRole('button', { name: 'Apply measurement' }).click();
}

test('guest can save and reload measurements locally', async ({ page }) => {
  await page.goto('/results');
  await enterWaist(page, 82, 'Enter');
  await page.getByRole('button', { name: 'Save on this device' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Load saved measurements' }).click();
  await expect(
    page.getByText('Saved measurements loaded from this device.'),
  ).toBeVisible();
  await expect(page.getByText('Tape entry', { exact: true })).toBeVisible();

  await page.goto('/my-measurements');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue as a guest' }),
  ).toBeVisible();
});

async function completeOAuth(
  page: Page,
  provider: 'google' | 'facebook',
  code: string,
  button: string,
) {
  const host =
    provider === 'google' ? 'accounts.google.com' : 'www.facebook.com';
  const providerUrl = new Promise<URL>((resolve) => {
    void page.route(
      `https://${host}/**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<title>Mock provider</title>',
        });
        resolve(new URL(route.request().url()));
      },
      { times: 1 },
    );
  });
  await page.getByRole('button', { name: button }).click();
  await page.waitForURL(`https://${host}/**`, {
    waitUntil: 'domcontentloaded',
  });
  const request = await providerUrl;
  const callback = new URL(request.searchParams.get('redirect_uri') ?? '');
  const state = request.searchParams.get('state');
  expect(state).toBeTruthy();
  if (provider === 'google')
    expect(request.searchParams.get('code_challenge')).toBeTruthy();
  callback.searchParams.set('state', state!);
  callback.searchParams.set('code', code);
  await page.goto(callback.href, { waitUntil: 'domcontentloaded' });
}

test('OAuth linking, private cloud profiles, and expired sessions', async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable PostgreSQL database');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const run = randomUUID();
  const second = await browser.newContext({ baseURL });
  try {
    await page.goto('/results');
    await enterWaist(page, 82, 'Enter');
    await page.getByRole('button', { name: 'Save on this device' }).click();
    await page.getByRole('link', { name: 'My Measurements' }).click();
    await completeOAuth(
      page,
      'google',
      `${run}:one:google`,
      'Continue with Google',
    );
    await expect(
      page.getByRole('heading', { name: 'My Measurements' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('Google connected')).toBeVisible();
    expect(
      (await page.context().cookies()).find(
        ({ name }) => name === 'authjs.session-token',
      ),
    ).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
    });

    await page.getByRole('button', { name: 'Import from this device' }).click();
    await expect(
      page.getByText('Measurements saved to your account.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Import from this device' }).click();
    await expect(
      page.getByText('These measurements are already saved.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'View profile' }).click();
    await expect(
      page.getByRole('heading', { name: 'Saved profile', exact: true }),
    ).toBeVisible();
    await page.waitForURL('**/my-measurements/*');
    const profileUrl = page.url();
    await enterWaist(page, 84, 'Edit');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      page.getByText('Changes saved to your account.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();
    await expect(page.getByText('Last updated')).toBeVisible();
    await page.reload();
    await expect(page.getByText(/^84/)).toBeVisible();

    const other = await second.newPage();
    await other.goto('/sign-in');
    await completeOAuth(
      other,
      'facebook',
      `${run}:one:facebook`,
      'Continue with Facebook',
    );
    await expect(other.locator('main').getByRole('alert')).toContainText(
      'Use your original provider',
    );

    await page.goto('/my-measurements');
    await completeOAuth(
      page,
      'facebook',
      `${run}:one:facebook`,
      'Connect Facebook',
    );
    await expect(page.getByText('Facebook connected')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.goto('/my-measurements');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await completeOAuth(
      other,
      'facebook',
      `${run}:two:facebook`,
      'Continue with Facebook',
    );
    await expect(
      other.getByRole('heading', { name: 'My Measurements' }),
    ).toBeVisible();
    await expect(other.getByText(/Signed in as Test two/)).toBeVisible();
    await other.goto(profileUrl);
    await expect(
      other.getByText('This page could not be found.'),
    ).toBeVisible();
    await expect(
      other.getByRole('heading', { name: 'Saved profile', exact: true }),
    ).toHaveCount(0);

    await completeOAuth(
      page,
      'facebook',
      `${run}:one:facebook`,
      'Continue with Facebook',
    );
    await expect(
      page.getByRole('heading', { name: 'My Measurements' }),
    ).toBeVisible();
    await page.goto(profileUrl);
    const user = await db.user.findUniqueOrThrow({
      where: { email: `${run}-one@example.test` },
    });
    await db.session.updateMany({
      where: { userId: user.id },
      data: { expires: new Date(0) },
    });
    await page
      .getByRole('button', { name: 'Delete profile', exact: true })
      .click();
    await page.getByRole('button', { name: 'Yes, delete profile' }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'Your session expired',
    );
    await expect(
      db.measurementProfile.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);

    await page.goto('/sign-in');
    await completeOAuth(
      page,
      'facebook',
      `${run}:one:facebook`,
      'Continue with Facebook',
    );
    await expect(
      page.getByRole('heading', { name: 'My Measurements' }),
    ).toBeVisible();
    await page.goto(profileUrl);
    await page
      .getByRole('button', { name: 'Delete profile', exact: true })
      .click();
    await page.getByRole('button', { name: 'Yes, delete profile' }).click();
    await expect(
      page.getByText('You haven’t saved a profile to your account yet.'),
    ).toBeVisible();
  } finally {
    await second.close();
    await db.user.deleteMany({ where: { email: { startsWith: run } } });
    await db.$disconnect();
  }
});
