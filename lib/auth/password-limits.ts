import 'server-only';

import { createHash, randomInt } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { database } from './db';

async function consume(key: string, limit: number) {
  const [accepted] = await database().$queryRaw<{ attempts: number }[]>`
    INSERT INTO "PasswordAttempt" ("key", "attempts", "expiresAt")
    VALUES (${key}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '10 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "PasswordAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        THEN 1 ELSE "PasswordAttempt"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "PasswordAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        THEN excluded."expiresAt" ELSE "PasswordAttempt"."expiresAt" END
    WHERE "PasswordAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') OR "PasswordAttempt"."attempts" < ${limit}
    RETURNING "attempts"
  `;
  return Boolean(accepted);
}

export async function allowPasswordAttempt(
  mode: 'register' | 'sign-in',
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

  if (randomInt(64) === 0) {
    await database().passwordAttempt.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }
  if (
    !(await consume(
      `${mode}:source:${sourceKey}`,
      mode === 'register' ? 12 : 60,
    ))
  )
    return false;
  if (mode === 'register') return true;
  const usernameKey = createHash('sha256').update(username).digest('hex');
  return consume(`sign-in:user:${usernameKey}`, 10);
}
