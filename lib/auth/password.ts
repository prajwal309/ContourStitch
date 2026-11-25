import 'server-only';

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const keyBytes = 32;
// OWASP's 32 MiB scrypt profile keeps memory bounded on the server.
const options = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const version = 'scrypt-v1';
const dummySalt = Buffer.alloc(16);
const dummyKey = Buffer.alloc(keyBytes);

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyBytes, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function parseUsername(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ? username : null;
}

export function validPassword(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 256) return false;
  const length = Array.from(value).length;
  return length >= 15 && length <= 128;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return [version, salt.toString('hex'), key.toString('hex')].join('$');
}

export async function verifyPassword(
  password: string,
  hash: string | undefined,
) {
  // Missing accounts still perform the same password derivation.
  const parts = hash?.match(/^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{64})$/);
  const salt = parts ? Buffer.from(parts[1], 'hex') : dummySalt;
  const expected = parts ? Buffer.from(parts[2], 'hex') : dummyKey;
  return timingSafeEqual(await derive(password, salt), expected) && !!parts;
}
