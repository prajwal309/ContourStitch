import 'server-only';

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import {
  consumeRateLimit,
  pruneRateLimitsOccasionally,
} from '@/lib/rate-limit';

export async function allowPasswordAttempt(
  mode: 'register' | 'sign-in' | 'recover' | 'recovery-code',
  username: string,
) {
  // Vercel sets this header at its edge. Use a shared bucket without a trusted client address.
  const source =
    process.env.VERCEL === '1'
      ? (await headers()).get('x-vercel-forwarded-for')?.trim()
      : undefined;
  const sourceKey = createHash('sha256')
    .update(source && isIP(source) ? source : 'shared')
    .digest('hex');

  await pruneRateLimitsOccasionally();
  if (
    !(await consumeRateLimit(
      `${mode}:source:${sourceKey}`,
      mode === 'sign-in' ? 60 : 12,
    ))
  )
    return false;
  if (mode === 'register') return true;
  const usernameKey = createHash('sha256').update(username).digest('hex');
  return consumeRateLimit(
    `${mode}:user:${usernameKey}`,
    mode === 'sign-in' ? 10 : 5,
  );
}
