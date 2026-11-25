import { expect, test } from '@playwright/test';

test('contact composer keeps founder addresses out of the browser UI', async ({
  page,
}) => {
  await page.goto('/contact');

  await expect(
    page.getByRole('heading', { name: 'Contact & feedback' }),
  ).toBeVisible();
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('all');
  await expect(page.getByLabel('From')).toBeEditable();
  await expect(page.getByLabel('Category')).toHaveValue('General Inquiry');
  await expect(page.locator('body')).not.toContainText(
    'tandooriwingslouisville@gmail.com',
  );
  await expect(page.locator('body')).not.toContainText('pniraula@mit.edu');
  await expect(page.locator('body')).not.toContainText('nirsun77@gmail.com');
});

test('sends to an individual co-founder and clears the draft on success', async ({
  page,
}) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/contact', async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sent: true }),
    });
  });

  await page.goto('/contact');
  await page.getByLabel('To', { exact: true }).selectOption('sundar');
  await page.getByLabel('From').fill('guest@example.com');
  await page.getByLabel('Subject').fill('Question about my profile');
  await page.getByLabel('Category').selectOption('General Inquiry');
  await page
    .getByLabel('Message')
    .fill('Could you explain how I can update my saved profile?');
  await page.getByRole('button', { name: 'Send Message' }).click();

  await expect(
    page
      .getByRole('status')
      .getByText(
        'Your message has been sent successfully. Thank you for reaching out!',
      ),
  ).toBeVisible();
  expect(submitted).toMatchObject({ recipient: 'sundar' });
  await expect(page.getByLabel('Subject')).toHaveValue('');
  await expect(page.getByLabel('Message')).toHaveValue('');
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('all');
});

test('keeps the draft after failure and retries all co-founders idempotently', async ({
  page,
}) => {
  let attempts = 0;
  const idempotencyKeys: Array<string | undefined> = [];
  const submissions: Array<Record<string, unknown>> = [];
  await page.route('**/api/contact', async (route) => {
    attempts += 1;
    idempotencyKeys.push(route.request().headers()['idempotency-key']);
    submissions.push(route.request().postDataJSON() as Record<string, unknown>);
    if (attempts === 1) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error:
            'We couldn’t send your message right now. Your draft is still here; please try again.',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sent: true }),
    });
  });

  await page.goto('/contact');
  await page.getByLabel('From').fill('guest@example.com');
  await page.getByLabel('Subject').fill('Feature idea');
  await page.getByLabel('Category').selectOption('Feature Request');
  await page.getByLabel('Message').fill('Please consider adding this feature.');

  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(
    page.getByText(
      'We couldn’t send your message right now. Your draft is still here; please try again.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue(
    'Please consider adding this feature.',
  );

  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Your message has been sent successfully.',
  );
  expect(submissions).toHaveLength(2);
  expect(submissions[0]).toEqual(submissions[1]);
  expect(submissions[0]).toMatchObject({ recipient: 'all' });
  expect(idempotencyKeys[0]).toBeTruthy();
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  await expect(page.getByLabel('Subject')).toHaveValue('');
});
