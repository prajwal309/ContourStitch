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
  if (!databaseUrl) {
    await expect(
      page.getByText('Account sign-in is currently unavailable.'),
    ).toBeVisible();
    expect((await page.request.get('/api/auth/providers')).status()).toBe(503);
    await page.getByRole('link', { name: 'Continue as a guest' }).click();
    await expect(page).toHaveURL(/\/measure$/);
  }
});

async function checkRegistration(page: Page, optional = false) {
  await page
    .getByRole('link', { name: 'Create an account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Create an account' }),
  ).toBeVisible();
  for (const checkbox of await page.getByRole('checkbox').all()) {
    await expect(checkbox).not.toBeChecked();
  }
  for (const checkbox of await page
    .getByRole('group', { name: 'Required agreements' })
    .getByRole('checkbox')
    .all()) {
    await checkbox.check();
  }
  if (optional)
    await page.getByRole('checkbox', { name: /used to improve/ }).check();
}

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
  expect(callback.pathname).toBe(`/api/auth/callback/${provider}`);
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
    await page.evaluate(() => {
      const key = 'contourstitch.profile.v1';
      const profile = JSON.parse(localStorage.getItem(key)!);
      profile.report.source = 'live-video';
      profile.report.estimates.push({
        key: 'arm',
        valueCm: 54,
        uncertaintyCm: null,
        confidence: 'low',
        method: 'Experimental video arm estimate',
        warnings: [],
        sidesCm: { left: 53, right: 55 },
      });
      localStorage.setItem(key, JSON.stringify(profile));
    });
    await page.getByRole('link', { name: 'My Fit Profile' }).click();
    await checkRegistration(page);
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
    await expect(page.getByText('Left 53 cm · Right 55 cm')).toBeVisible();
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

    await other.goto('/sign-in');
    await checkRegistration(other);
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
    await expect(page.locator('.measurement-value').first()).toContainText(
      '84',
    );
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

test('family invitations, private measurement sharing, and account deletion', async ({
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
    await checkRegistration(page);
    await completeOAuth(
      page,
      'google',
      `${run}:organizer:google`,
      'Continue with Google',
    );
    await page.getByLabel('Group name').fill('Wedding fitting');
    await page.getByLabel('Fitting occasion').fill('Reception in June');
    await page.getByRole('button', { name: 'Create group' }).click();
    await expect(
      page.getByRole('heading', { name: 'Wedding fitting' }),
    ).toBeVisible();
    await expect(page.getByText('Reception in June')).toBeVisible();
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
    await checkRegistration(member);
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
    const wearer = await db.user.findUniqueOrThrow({
      where: { email: `${run}-member@example.test` },
    });
    const profile = await db.measurementProfile.findFirstOrThrow({
      where: { userId: wearer.id },
    });
    const revision = await db.measurementRevision.findFirstOrThrow({
      where: { profileId: profile.id, version: 1 },
    });
    const observations = await db.measurementObservation.findMany({
      where: { revisionId: revision.id },
    });
    expect(observations.find(({ key }) => key === 'chest')).toMatchObject({
      valueCm: 104.37,
      unit: 'cm',
      uncertaintyCm: null,
      method: 'Manually entered tape measurement',
    });
    const selection = await db.outfitSelection.create({
      data: {
        userId: wearer.id,
        groupId,
        scopeKey: `group:${groupId}`,
        productKey: 'heritage-kurta',
        variantKey: 'copper-linen',
        fitRevisionId: revision.id,
        extraCm: { kurtaLength: 116.8 },
        preference: '',
        fitComplete: true,
        usesProfile: true,
      },
    });
    await member.goto(groupUrl);
    await expect(
      member.getByRole('heading', { name: 'Your membership' }),
    ).toBeVisible();
    await expect(member.getByText(/Heritage Kurta|saved outfit/i)).toHaveCount(
      0,
    );
    expect(
      await member.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.goto(groupUrl);
    await expect(
      page.getByRole('heading', { name: 'Group members' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Heritage Kurta|selected an outfit/i),
    ).toHaveCount(0);
    await expect(page.getByText(/104\.37|116\.8/)).toHaveCount(0);
    expect(await page.content()).not.toContain('116.8');
    await expect(
      page.getByText('Waist circumference', { exact: true }),
    ).toHaveCount(0);
    await member.getByLabel('Saved measurement set').selectOption(revision.id);
    await member.getByRole('button', { name: 'Share with organizer' }).click();
    await expect(member.getByRole('status')).toContainText(
      'Measurements shared with the organizer.',
    );
    await page.reload();
    await page.getByText('Shared measurements', { exact: false }).click();
    await expect(page.getByText('83 cm', { exact: true })).toBeVisible();

    await member.goto('/account');
    await expect(member.getByText(/Heritage Kurta|saved outfits/i)).toHaveCount(
      0,
    );
    await member.getByLabel('Display name').fill('Wedding guest');
    await member.getByRole('button', { name: 'Save display name' }).click();
    await expect(member.getByText('Display name saved.')).toBeVisible();
    await page.goto(groupUrl);
    await expect(
      page.getByText('Wedding guest', { exact: true }),
    ).toBeVisible();

    await page.goto(`/my-measurements/${profile.id}`);
    await expect(page.getByText('This page could not be found.')).toBeVisible();

    await member.goto(`/my-measurements/${profile.id}`);
    await enterWaist(member, 88, 'Edit');
    await member.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      member.getByText('Changes saved to your account.'),
    ).toBeVisible();
    const unchanged = await db.outfitSelection.findUniqueOrThrow({
      where: { id: selection.id },
      include: { fitRevision: true },
    });
    expect(unchanged.fitRevision?.corrections).toMatchObject({ waist: 83 });

    const latest = await db.measurementRevision.findFirstOrThrow({
      where: { profileId: profile.id, version: 2 },
    });
    expect(latest.corrections).toMatchObject({ waist: 88 });
    await expect(
      db.measurementObservation.findUnique({
        where: {
          revisionId_key: { revisionId: latest.id, key: 'waist' },
        },
      }),
    ).resolves.toMatchObject({
      valueCm: 88,
      uncertaintyCm: null,
      method: 'Manually entered tape measurement',
    });

    await page.goto(groupUrl);
    await page.getByText('Shared measurements', { exact: false }).click();
    await expect(page.getByText('83 cm', { exact: true })).toBeVisible();
    await expect(page.getByText('88 cm', { exact: true })).toHaveCount(0);
    await member.goto(groupUrl);
    await member.getByRole('button', { name: 'Revoke access' }).click();
    await expect(member.getByRole('status')).toContainText(
      'Measurement access revoked.',
    );
    await page.reload();
    await expect(
      page.getByText('Waist circumference', { exact: true }),
    ).toHaveCount(0);

    const stranger = await strangerContext.newPage();
    await stranger.goto('/sign-in');
    await checkRegistration(stranger);
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

    await member.getByLabel('Saved measurement set').selectOption(latest.id);
    await member.getByRole('button', { name: 'Share with organizer' }).click();
    await expect(member.getByRole('status')).toContainText(
      'Measurements shared with the organizer.',
    );
    const organizer = await db.user.findUniqueOrThrow({
      where: { email: `${run}-organizer@example.test` },
    });
    await confirmAccountDeletion(page);
    await expect(db.user.count({ where: { id: organizer.id } })).resolves.toBe(
      0,
    );
    await expect(
      db.familyProfileShare.count({ where: { groupId } }),
    ).resolves.toBe(0);
    await expect(
      db.familyGroup.findUnique({ where: { id: groupId } }),
    ).resolves.toMatchObject({ organizerId: wearer.id });
    await expect(
      db.measurementProfile.count({ where: { userId: wearer.id } }),
    ).resolves.toBe(1);
    await confirmAccountDeletion(member);
    await expect(
      db.session.count({ where: { userId: wearer.id } }),
    ).resolves.toBe(0);
    await expect(
      db.account.count({ where: { userId: wearer.id } }),
    ).resolves.toBe(0);
    await expect(
      db.measurementProfile.count({ where: { userId: wearer.id } }),
    ).resolves.toBe(0);
    await expect(
      db.measurementRevision.count({ where: { profileId: profile.id } }),
    ).resolves.toBe(0);
  } finally {
    await Promise.all([memberContext.close(), strangerContext.close()]);
    await db.user.deleteMany({ where: { email: { startsWith: run } } });
    await db.$disconnect();
  }
});

async function confirmAccountDeletion(page: Page) {
  await page.goto('/account');
  await page.getByText('Delete my account', { exact: true }).click();
  await page
    .getByLabel('Type DELETE to confirm', { exact: true })
    .fill('DELETE');
  await page
    .getByRole('button', { name: 'Permanently delete account' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
}

test('registration consent, renewal, withdrawal, and data deletion are persisted', async ({
  page,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable PostgreSQL database');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const run = randomUUID();
  const email = `${run}-consent@example.test`;
  const code = `${run}:consent:google`;

  const readCameraCalls = () =>
    page.evaluate(
      () =>
        (window as Window & { consentTestCameraCalls?: number })
          .consentTestCameraCalls,
    );

  try {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addInitScript(() => {
      const state = Object.assign(window, { consentTestCameraCalls: 0 });
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => {
            state.consentTestCameraCalls += 1;
            throw new DOMException('Test denial', 'NotAllowedError');
          },
        },
      });
    });

    await page.goto('/sign-in?next=%2Faccount');
    // Existing-account sign-in must never create a new user with no consent.
    await completeOAuth(page, 'google', code, 'Continue with Google');
    await expect(
      page.getByRole('heading', { name: 'Create an account' }),
    ).toBeVisible();
    await expect(db.user.findUnique({ where: { email } })).resolves.toBeNull();
    await page.goto('/sign-in?next=%2Faccount');
    await checkRegistration(page);
    const legal = page.getByRole('link', { name: /^Body Measurement Consent/ });
    const [draft] = await Promise.all([
      page.waitForEvent('popup'),
      legal.click(),
    ]);
    await expect(
      draft.getByText('Draft pending legal review', { exact: false }),
    ).toBeVisible();
    await draft.close();
    await expect(
      page.getByRole('checkbox', { name: /I consent to camera/ }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: /used to improve/ }),
    ).not.toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
    await completeOAuth(page, 'google', code, 'Continue with Google');
    await expect(
      page.getByRole('heading', { name: 'Privacy & Consent' }),
    ).toBeVisible();

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const where = { userId: user.id };
    const initial = await db.consentEvent.findMany({ where });
    expect(initial).toHaveLength(5);
    expect(
      initial.filter(
        ({ status, acceptedAt }) => status === 'ACCEPTED' && acceptedAt,
      ),
    ).toHaveLength(4);
    expect(initial.find(({ type }) => type === 'IMPROVEMENT')).toMatchObject({
      status: 'DECLINED',
      acceptedAt: null,
      revokedAt: null,
    });

    await page.getByRole('checkbox', { name: /used to improve/ }).check();
    await page.getByRole('button', { name: 'Save optional consent' }).click();
    await expect(
      page.getByRole('button', { name: 'Withdraw optional consent' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Withdraw optional consent' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Save optional consent' }),
    ).toBeVisible();
    const history = await db.consentEvent.findMany({
      where: { ...where, type: 'IMPROVEMENT' },
      orderBy: { id: 'asc' },
    });
    expect(history.map(({ status }) => status)).toEqual([
      'DECLINED',
      'ACCEPTED',
      'REVOKED',
    ]);
    expect(history[2].acceptedAt).toEqual(history[1].acceptedAt);
    expect(history[2].revokedAt).toBeInstanceOf(Date);
    await page.getByRole('button', { name: 'Withdraw camera consent' }).click();
    await expect(
      page.getByRole('button', { name: 'Withdraw camera consent' }),
    ).toHaveCount(0);
    await page.goto('/measure/experimental');
    await page.getByRole('button', { name: 'Continue →' }).click();
    await expect(
      page.getByRole('button', { name: 'Continue to video scan' }),
    ).toHaveCount(0);
    expect(await readCameraCalls()).toBe(0);
    await page.goto('/measure');
    await expect(
      page.getByRole('checkbox', { name: /I consent to camera/ }),
    ).not.toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: /measurements are estimates/ }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: /Continue privately/ }).click();
    await expect(
      page.getByRole('button', { name: /Start guided video/ }),
    ).toHaveCount(0);
    expect(await readCameraCalls()).toBe(0);
    await page.getByRole('checkbox', { name: /I consent to camera/ }).check();
    await page.getByRole('button', { name: /Continue privately/ }).click();
    await page.getByRole('button', { name: /Start guided video/ }).click();
    await expect(page.getByText(/Camera permission was denied/)).toBeVisible();
    expect(await readCameraCalls()).toBe(1);

    const currentTerms = initial.find(({ type }) => type === 'TERMS')!;
    // Seed a prior acceptance to exercise deployment of a new agreement version.
    await db.consentEvent.update({
      where: { id: currentTerms.id },
      data: { agreementVersion: 'prior' },
    });
    await page.goto('/my-measurements');
    await expect(
      page.getByRole('heading', { name: 'Review your agreements' }),
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'I agree to the Terms of Service.' }),
    ).not.toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: /Privacy Policy/ }),
    ).toHaveCount(0);
    await page
      .getByRole('checkbox', { name: 'I agree to the Terms of Service.' })
      .check();
    await page.getByRole('button', { name: 'Accept and continue' }).click();
    await expect(
      page.getByRole('heading', { name: 'My Fit Profile' }),
    ).toBeVisible();
    const terms = await db.consentEvent.findMany({
      where: { ...where, type: 'TERMS' },
      orderBy: { id: 'asc' },
    });
    expect(terms.map(({ agreementVersion }) => agreementVersion)).toEqual([
      'prior',
      currentTerms.agreementVersion,
    ]);

    await page.goto('/results');
    await enterWaist(page, 82, 'Enter');
    await page.getByRole('button', { name: 'Save on this device' }).click();
    await page.goto('/my-measurements');
    await page.getByRole('button', { name: 'Import from this device' }).click();
    await expect(
      page.getByText('Measurements saved to your account.'),
    ).toBeVisible();
    await page.goto('/account');
    await page
      .getByText('Previously accepted versions', { exact: true })
      .click();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'Terms of Service · Version prior' }),
    ).toBeVisible();
    await page.getByText('Delete my measurement data', { exact: true }).click();
    await page
      .getByLabel('Type DELETE to confirm measurement deletion')
      .fill('DELETE');
    await page
      .getByRole('button', { name: 'Permanently delete measurements' })
      .click();
    await expect(page.getByRole('status')).toContainText(
      'Measurements deleted from your account and this browser.',
    );
    await expect(db.measurementProfile.count({ where })).resolves.toBe(0);
    await expect(db.user.count({ where: { id: user.id } })).resolves.toBe(1);
    expect(
      await page.evaluate(() =>
        localStorage.getItem('contourstitch.profile.v1'),
      ),
    ).toBeNull();

    await page.getByRole('checkbox', { name: /used to improve/ }).check();
    const count = await db.consentEvent.count({ where });
    await db.session.updateMany({ where, data: { expires: new Date(0) } });
    await page.getByRole('button', { name: 'Save optional consent' }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'Your sign-in changed',
    );
    await expect(db.consentEvent.count({ where })).resolves.toBe(count);

    await page.goto('/sign-in');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await completeOAuth(page, 'google', code, 'Continue with Google');
    await expect(
      page.getByRole('heading', { name: 'My Fit Profile' }),
    ).toBeVisible();
    await expect(db.consentEvent.count({ where })).resolves.toBe(count);
    await confirmAccountDeletion(page);
    await expect(db.consentEvent.count({ where })).resolves.toBe(0);
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
