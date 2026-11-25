import { expect, it } from 'vitest';

import {
  hashPassword,
  parseUsername,
  verifyPassword,
} from '@/lib/auth/password';
import { validPassword } from '@/lib/auth/password-policy';

it('normalizes usernames and preserves case and spaces in passwords', () => {
  expect(parseUsername('  Stitch.Fan  ')).toBe('stitch.fan');
  expect(parseUsername('a@example.test')).toBeNull();
  expect(parseUsername('ab')).toBeNull();
  expect(validPassword('short')).toBe(false);
  expect(validPassword('🧵'.repeat(128))).toBe(true);
  expect(validPassword('🧵'.repeat(129))).toBe(false);
});

it('salts each password and verifies only the original value', async () => {
  const password = ' A longer passphrase! ';
  const [first, second] = await Promise.all([
    hashPassword(password),
    hashPassword(password),
  ]);
  expect(first).toMatch(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
  expect(first).not.toBe(second);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword(password.trim(), first)).toBe(false);
  expect(await verifyPassword(password, undefined)).toBe(false);
});
