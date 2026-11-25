import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash, randomUUID } from 'node:crypto';

const databaseUrl = process.env.CONTOURSTITCH_TEST_DATABASE_URL;

test('creates and signs in to an account with a password, with consent and a revocable session', async ({
  page,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable PostgreSQL database');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const username = `fit.${randomUUID().slice(0, 8)}`;
  const password = 'Thread and thimble 107!';
  const accountPath = '/sign-in?next=%2Faccount';
  const usernameHash = createHash('sha256').update(username).digest('hex');
  const counter = `sign-in:user:${usernameHash}`;

  const fillSignIn = async (value: string) => {
    await page
      .getByLabel('Username', { exact: true })
      .fill(username.toUpperCase());
    await page.getByLabel('Password', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  };

  try {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(accountPath);
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
    if (process.env.CONTOURSTITCH_TEST_PASSWORD_ONLY === '1') {
      await expect(
        page.getByRole('button', {
          name: /Continue with Google|Continue with Facebook/,
        }),
      ).toHaveCount(0);
      const providers = await page.request.get('/api/auth/providers');
      expect(providers.status()).toBe(200);
      expect(await providers.json()).toEqual({});
    }

    await page
      .getByRole('link', { name: 'Create an account', exact: true })
      .click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password', { exact: true }).fill(password);
    await expect(
      page.getByRole('checkbox', { name: /allow my measurement data/ }),
    ).not.toBeChecked();
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Create an account' }),
    ).toBeVisible();
    expect(
      await db.passwordLogin.findUnique({ where: { username } }),
    ).toBeNull();
    for (const checkbox of await page
      .getByRole('group', { name: 'Required agreement' })
      .getByRole('checkbox')
      .all()) {
      await checkbox.check();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);

    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password', { exact: true }).fill(password);
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();

    await expect(
      page.getByRole('heading', { name: 'My Account' }),
    ).toBeVisible();
    await expect(page.getByText(username, { exact: true })).toBeVisible();
    const login = await db.passwordLogin.findUniqueOrThrow({
      where: { username },
      include: { user: { include: { accounts: true, consentEvents: true } } },
    });
    expect(login.passwordHash).toMatch(/^scrypt-v1\$/);
    expect(login.user.email).toBeNull();
    expect(login.user.accounts).toHaveLength(0);
    expect(
      login.user.consentEvents.filter(({ status }) => status === 'ACCEPTED'),
    ).toHaveLength(4);
    expect(
      login.user.consentEvents.find(({ type }) => type === 'IMPROVEMENT')
        ?.status,
    ).toBe('DECLINED');
    const cookie = (await page.context().cookies()).find(
      ({ name }) => name === 'authjs.session-token',
    );
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
    expect(
      await db.session.findUnique({ where: { sessionToken: cookie!.value } }),
    ).toMatchObject({ userId: login.userId });
    expect((await page.request.get('/api/health/database')).status()).toBe(200);

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(
      await db.session.findUnique({ where: { sessionToken: cookie!.value } }),
    ).toBeNull();
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await fillSignIn(password + ' wrong');
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'Check your username and password',
    );
    expect(await db.session.count({ where: { userId: login.userId } })).toBe(0);

    await db.passwordAttempt.update({
      where: { key: counter },
      data: { attempts: 10, expiresAt: new Date(Date.now() + 60_000) },
    });
    await fillSignIn(password);
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'Too many attempts',
    );
    await db.passwordAttempt.updateMany({
      where: { key: counter },
      data: { expiresAt: new Date(0) },
    });
    await fillSignIn(password);
    await expect(
      page.getByRole('heading', { name: 'My Account' }),
    ).toBeVisible();
    const newCookie = (await page.context().cookies()).find(
      ({ name }) => name === 'authjs.session-token',
    );
    expect(newCookie?.value).not.toBe(cookie?.value);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'My Account' }),
    ).toBeVisible();
    await page.getByText('Delete my account', { exact: true }).click();
    await page
      .getByLabel('Type DELETE to confirm', { exact: true })
      .fill('DELETE');
    await page
      .getByRole('button', { name: 'Permanently delete account' })
      .click();
    await expect(page).toHaveURL(/\/$/);
    expect(
      await db.passwordLogin.findUnique({ where: { username } }),
    ).toBeNull();
    expect(await db.session.count({ where: { userId: login.userId } })).toBe(0);
  } finally {
    const login = await db.passwordLogin.findUnique({ where: { username } });
    if (login) await db.user.deleteMany({ where: { id: login.userId } });
    await db.passwordAttempt.deleteMany({ where: { key: counter } });
    await db.$disconnect();
  }
});

test('rejects breached passwords and duplicate registrations and resets a password with a one-time recovery code', async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable PostgreSQL database');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const username = `recovery.${randomUUID().slice(0, 8)}`;
  const initial = 'The studio window faces west';
  const updated = 'Ivory wool and a pearl button';
  const other = await browser.newContext({ baseURL });

  async function register(
    target: import('@playwright/test').Page,
    password: string,
  ) {
    await target.goto('/sign-in?mode=register&next=%2Faccount');
    await target
      .getByRole('checkbox', { name: /^I agree to the Terms/ })
      .check();
    await target.getByLabel('Username', { exact: true }).fill(username);
    await target.getByLabel('Password', { exact: true }).fill(password);
    const show = target.getByRole('button', {
      name: 'Show password',
      exact: true,
    });
    await show.click();
    await expect(
      target.getByLabel('Password', { exact: true }),
    ).toHaveAttribute('type', 'text');
    await target
      .getByRole('button', { name: 'Hide password', exact: true })
      .click();
    await target.getByLabel('Confirm password', { exact: true }).fill(password);
    await target
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
  }

  try {
    await register(page, 'correcthorsebatterystaple');
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'appeared in a data breach',
    );
    expect(
      await db.passwordLogin.findUnique({ where: { username } }),
    ).toBeNull();

    await register(page, initial);
    await expect(
      page.getByRole('heading', { name: 'My Account' }),
    ).toBeVisible();
    const login = await db.passwordLogin.findUniqueOrThrow({
      where: { username },
    });
    const visitor = await other.newPage();
    await register(visitor, initial);
    await expect(visitor.locator('main').getByRole('alert')).toContainText(
      'username is unavailable',
    );

    await page.getByText('Password recovery code', { exact: true }).click();
    await page.getByLabel('Current password', { exact: true }).fill(initial);
    await page.getByRole('button', { name: 'Generate recovery code' }).click();
    const code = page.locator('.recovery-code code');
    await expect(code).toBeVisible();
    const recoveryCode = await code.innerText();
    const enrolled = await db.passwordLogin.findUniqueOrThrow({
      where: { username },
    });
    expect(enrolled.recoveryCodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(enrolled.recoveryCodeHash).not.toBe(recoveryCode);
    expect(await db.session.count({ where: { userId: login.userId } })).toBe(1);

    async function reset() {
      await visitor.goto('/sign-in?mode=recover&next=%2Faccount');
      await visitor.getByLabel('Username', { exact: true }).fill(username);
      await visitor
        .getByLabel('Recovery code', { exact: true })
        .fill(recoveryCode);
      await visitor.getByLabel('New password', { exact: true }).fill(updated);
      await visitor
        .getByLabel('Confirm new password', { exact: true })
        .fill(updated);
      await visitor
        .getByRole('button', { name: 'Reset password', exact: true })
        .click();
    }
    await reset();
    await expect(
      visitor.getByText('Password updated. Sign in with your new password.'),
    ).toBeVisible();
    expect(await db.session.count({ where: { userId: login.userId } })).toBe(0);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await reset();
    await expect(visitor.locator('main').getByRole('alert')).toContainText(
      'can only be used once',
    );
    await visitor.goto('/sign-in?next=%2Faccount');
    await visitor.getByLabel('Username', { exact: true }).fill(username);
    await visitor.getByLabel('Password', { exact: true }).fill(updated);
    await visitor.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      visitor.getByRole('heading', { name: 'My Account' }),
    ).toBeVisible();
  } finally {
    await other.close();
    const login = await db.passwordLogin.findUnique({ where: { username } });
    if (login) await db.user.deleteMany({ where: { id: login.userId } });
    await db.$disconnect();
  }
});
