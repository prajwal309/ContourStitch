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
    await page.getByRole('link', { name: 'My Fit Profile' }).click();
    await completeOAuth(
      page,
      'google',
      `${run}:one:google`,
      'Continue with Google',
    );
    await expect(
      page.getByRole('heading', { name: 'My Fit Profile' }),
    ).toBeVisible();
    await page.reload();
    await page.goto('/account');
    await expect(page.getByText('Google connected')).toBeVisible();
    await page.goto('/my-measurements');
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
    await expect(page.locator('.measurement-value').first()).toContainText(
      '84',
    );
    await expect(
      page.getByRole('heading', { name: 'Measurement history' }),
    ).toBeVisible();
    await page.locator('.revision-detail summary').last().click();
    await expect(page.locator('.revision-detail').last()).toContainText(
      '82 cm',
    );

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

    await page.goto('/account');
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
      other.getByRole('heading', { name: 'My Fit Profile' }),
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
      page.getByRole('heading', { name: 'My Fit Profile' }),
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
      page.getByRole('heading', { name: 'My Fit Profile' }),
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

test('a family reuses private fit revisions across preview outfits', async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable PostgreSQL database');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const memberContext = await browser.newContext({
    baseURL,
    viewport: { width: 360, height: 800 },
  });
  const strangerContext = await browser.newContext({ baseURL });
  const run = randomUUID();

  try {
    await page.goto('/family-fit');
    await page.getByRole('link', { name: 'Sign in to get started' }).click();
    await completeOAuth(
      page,
      'google',
      `${run}:organizer:google`,
      'Continue with Google',
    );
    await page.getByLabel('Group name').fill('Wedding fitting');
    await page.getByRole('button', { name: 'Create group' }).click();
    await expect(
      page.getByRole('heading', { name: 'Wedding fitting' }),
    ).toBeVisible();
    const groupUrl = page.url();
    const groupId = new URL(groupUrl).pathname.split('/').at(-1)!;

    await page.getByRole('button', { name: 'Create invitation' }).click();
    const sharedLink = page.getByRole('textbox', { name: 'Invitation link' });
    await expect(sharedLink).toBeVisible();
    const revoked = await sharedLink.inputValue();
    await page.getByRole('button', { name: 'Revoke invitation' }).click();
    await expect(page.getByText('Revoked', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Create invitation' }).click();
    await expect(sharedLink).toBeVisible();
    const invitation = await sharedLink.inputValue();
    expect(new URL(invitation).hash).toMatch(/^#[a-f0-9]{64}$/);
    const savedInvites = await db.familyInvitation.findMany({
      where: { groupId },
    });
    expect(
      savedInvites.some(
        ({ tokenHash }) => tokenHash === new URL(invitation).hash.slice(1),
      ),
    ).toBe(false);

    const member = await memberContext.newPage();
    await member.goto(invitation);
    await member.getByRole('link', { name: 'Sign in to accept' }).click();
    await completeOAuth(
      member,
      'facebook',
      `${run}:member:facebook`,
      'Continue with Facebook',
    );
    await expect(
      member.getByRole('heading', { name: 'Group invitation' }),
    ).toBeVisible();
    await member.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(
      member.getByRole('heading', { name: 'Wedding fitting' }),
    ).toBeVisible();
    await expect(
      member.getByRole('button', { name: 'Create invitation' }),
    ).toHaveCount(0);

    const tape = Object.entries({
      chest: 104.37,
      waist: 83,
      shoulder: 41,
      sleeve: 59,
      hip: 99,
    }).map(([key, valueCm]) => ({
      key,
      valueCm,
      uncertaintyCm: 2,
      confidence: 'low',
      method: 'Manually entered tape measurement',
      warnings: [],
    }));
    await member.evaluate(
      (estimates) =>
        window.localStorage.setItem(
          'contourstitch.profile.v1',
          JSON.stringify({
            version: 1,
            unit: 'cm',
            report: { estimates, missing: {} },
          }),
        ),
      tape,
    );
    await member.goto('/my-measurements');
    await member
      .getByRole('button', { name: 'Import from this device' })
      .click();
    await expect(
      member.getByText('Measurements saved to your account.'),
    ).toBeVisible();
    await member.goto(`/shop/heritage-kurta?group=${groupId}`);
    await expect(
      member.getByText(/4 of 5 dimensions from your saved profile/),
    ).toBeVisible();
    await member.getByLabel('Preferred kurta length (cm)').fill('116.8');
    await member.getByLabel('Color and fabric').selectOption('copper-linen');
    await member.getByRole('button', { name: 'Save my outfit' }).click();
    await expect(
      member.getByText('Outfit saved.', { exact: true }),
    ).toBeVisible();
    expect(
      await member.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.goto(groupUrl);
    await expect(
      page.getByText(
        /Heritage Kurta · Copper · Soft linen blend · Fit details entered/,
      ),
    ).toBeVisible();
    await expect(page.getByText(/104\.37|116\.8/)).toHaveCount(0);
    expect(await page.content()).not.toContain('116.8');

    const wearer = await db.user.findUniqueOrThrow({
      where: { email: `${run}-member@example.test` },
    });
    const profile = await db.measurementProfile.findFirstOrThrow({
      where: { userId: wearer.id },
    });
    const first = await db.outfitSelection.findFirstOrThrow({
      where: { userId: wearer.id, groupId },
      include: { fitRevision: true },
    });
    expect(first.fitRevision?.version).toBe(1);
    await page.goto(`/my-measurements/${profile.id}`);
    await expect(page.getByText('This page could not be found.')).toBeVisible();

    await member.goto(`/my-measurements/${profile.id}`);
    await enterWaist(member, 88, 'Edit');
    await member.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      member.getByText('Changes saved to your account.'),
    ).toBeVisible();
    const unchanged = await db.outfitSelection.findUniqueOrThrow({
      where: { id: first.id },
      include: { fitRevision: true },
    });
    expect(unchanged.fitRevision?.corrections).toMatchObject({ waist: 83 });

    await member.goto('/shop/heritage-lehenga');
    await expect(
      member.getByText(/2 of 4 dimensions from your saved profile/),
    ).toBeVisible();
    await expect(member.getByLabel('Bust circumference (cm)')).toBeVisible();
    await expect(
      member.getByLabel('Preferred skirt length (cm)'),
    ).toBeVisible();
    await member.getByRole('button', { name: 'Save my outfit' }).click();
    await expect(
      member.getByText('Outfit saved.', { exact: true }),
    ).toBeVisible();
    const second = await db.outfitSelection.findFirstOrThrow({
      where: { userId: wearer.id, groupId: null },
      include: { fitRevision: true },
    });
    expect(second.fitRevision).toMatchObject({
      profileId: profile.id,
      version: 2,
    });

    const stranger = await strangerContext.newPage();
    await stranger.goto('/sign-in');
    await completeOAuth(
      stranger,
      'google',
      `${run}:stranger:google`,
      'Continue with Google',
    );
    await stranger.goto(groupUrl);
    await expect(
      stranger.getByText('This page could not be found.'),
    ).toBeVisible();
    for (const link of [revoked, invitation]) {
      await stranger.goto(link);
      await stranger.getByRole('button', { name: 'Accept invitation' }).click();
      await expect(stranger.locator('main').getByRole('alert')).toContainText(
        'This invitation is invalid',
      );
    }
  } finally {
    await Promise.all([memberContext.close(), strangerContext.close()]);
    await db.user.deleteMany({ where: { email: { startsWith: run } } });
    await db.$disconnect();
  }
});
