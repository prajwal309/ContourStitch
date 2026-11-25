import 'server-only';

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import {
  consumeRateLimit,
  pruneRateLimitsOccasionally,
} from '@/lib/rate-limit';

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function allowContactAttempt(email: string) {
  const source =
    process.env.VERCEL === '1'
      ? (await headers()).get('x-vercel-forwarded-for')?.trim()
      : undefined;
  const sourceKey = hash(source && isIP(source) ? source : 'shared');
  const emailKey = hash(email.trim().toLowerCase());

  await pruneRateLimitsOccasionally();
  if (!(await consumeRateLimit(`contact:source:${sourceKey}`, 12)))
    return false;
  return consumeRateLimit(`contact:email:${emailKey}`, 5);
}
