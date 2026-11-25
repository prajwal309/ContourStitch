import 'server-only';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { authConfiguration } from './configuration';
import { database } from './db';

export const sessionMaxAge = 30 * 24 * 60 * 60;
export const sessionOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: authConfiguration.secure,
} as const;
export const sessionCookie = authConfiguration.secure
  ? '__Host-authjs.session-token'
  : 'authjs.session-token';

export function newSession() {
  return {
    sessionToken: randomBytes(32).toString('base64url'),
    expires: new Date(Date.now() + sessionMaxAge * 1000),
  };
}

export async function sessionToken() {
  const token = (await cookies()).get(sessionCookie)?.value;
  return token && /^[a-zA-Z0-9_-]{32,128}$/.test(token) ? token : undefined;
}

export async function writeSessionCookie(
  session: ReturnType<typeof newSession>,
) {
  // Match the cookie used by Auth.js so either sign-in method can use the same session.
  (await cookies()).set(sessionCookie, session.sessionToken, {
    ...sessionOptions,
    expires: session.expires,
  });
}

export async function readDatabaseUser() {
  const token = await sessionToken();
  if (!token) return null;
  const session = await database().session.findUnique({
    where: { sessionToken: token, expires: { gt: new Date() } },
    select: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return session?.user ?? null;
}

export async function revokeDatabaseSession() {
  const token = await sessionToken();
  try {
    if (token && authConfiguration.problems.length === 0) {
      await database().session.deleteMany({ where: { sessionToken: token } });
    }
  } finally {
    (await cookies()).set(sessionCookie, '', { ...sessionOptions, maxAge: 0 });
  }
}
