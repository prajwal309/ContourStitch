import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { passwordScreening } from '@/lib/auth/password-screening';

const password = 'correcthorsebatterystaple';
const digest = createHash('sha1').update(password).digest('hex').toUpperCase();

afterEach(() => vi.unstubAllGlobals());

it('sends a padded prefix-only lookup and rejects a breached password', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(`${digest.slice(5)}:37\r\n`));
  vi.stubGlobal('fetch', fetch);
  await expect(passwordScreening(password)).resolves.toBe('compromised');
  expect(fetch).toHaveBeenCalledWith(
    `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`,
    expect.objectContaining({
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    }),
  );
});

it('ignores padding matches and fails closed on invalid or unreachable responses', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(`${digest.slice(5)}:0`))
    .mockResolvedValueOnce(new Response(''))
    .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    .mockRejectedValueOnce(new Error('timeout'));
  vi.stubGlobal('fetch', fetch);
  for (const result of ['clear', 'unavailable', 'unavailable', 'unavailable'])
    await expect(passwordScreening(password)).resolves.toBe(result);
});
