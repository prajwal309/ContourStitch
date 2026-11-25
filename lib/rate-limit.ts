import 'server-only';

import { randomInt } from 'node:crypto';
import { database } from '@/lib/auth/db';

export async function consumeRateLimit(key: string, limit: number) {
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

export async function pruneRateLimitsOccasionally() {
  if (randomInt(64) === 0) {
    await database().passwordAttempt.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }
}
