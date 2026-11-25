import { expect, it } from 'vitest';

import {
  hashPassword,
  parseUsername,
  verifyPassword,
} from '@/lib/auth/password';
import {
  passwordLengthMessage,
  passwordMaxLength,
  passwordMaxLengthMessage,
  passwordMinLength,
  validPassword,
  validPasswordForVerification,
} from '@/lib/auth/password-policy';

it('normalizes usernames and preserves case and spaces in passwords', () => {
  expect(parseUsername('  Stitch.Fan  ')).toBe('stitch.fan');
  expect(parseUsername('a@example.test')).toBeNull();
  expect(parseUsername('ab')).toBeNull();
  expect(passwordMinLength).toBe(8);
  expect(passwordLengthMessage).toBe(
    'Use at least 8 characters, including one special character.',
  );
  expect(validPassword('a'.repeat(6) + '!')).toBe(false);
  expect(validPassword('abcdefgh')).toBe(false);
  expect(validPassword('1234567!')).toBe(true);
  expect(validPassword('1234567 ')).toBe(false);
  expect(validPassword(' A passphrase with spaces! ')).toBe(true);
  expect(validPassword('a'.repeat(passwordMaxLength - 1) + '!')).toBe(true);
  expect(validPassword('a'.repeat(passwordMaxLength + 1))).toBe(false);
  expect(passwordMaxLengthMessage).toBe('Use no more than 128 characters.');
  expect(validPassword('🧵'.repeat(127) + '!')).toBe(true);
  expect(validPassword('🧵'.repeat(128))).toBe(true);
  expect(validPassword('🧵'.repeat(128) + '!')).toBe(false);
  expect(validPassword('The legacy password')).toBe(false);
  expect(validPasswordForVerification('The legacy password')).toBe(true);
  expect(validPasswordForVerification('x'.repeat(129))).toBe(false);
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
