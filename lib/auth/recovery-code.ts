import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

export function recoveryCodeHash(value: unknown) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const normalized = value.trim().replaceAll('-', '').toLowerCase();
  return /^[a-f0-9]{32}$/.test(normalized)
    ? createHash('sha256').update(normalized).digest('hex')
    : null;
}

export function newRecoveryCode() {
  const value = randomBytes(16).toString('hex');
  return value.match(/.{8}/g)!.join('-');
}
