import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export const oauthIntentLifetime = 15 * 60;
const secure =
  process.env.AUTH_URL?.toLowerCase().startsWith('https://') ?? false;
export const oauthIntentCookie = secure
  ? '__Host-contourstitch-oauth'
  : 'contourstitch-oauth';
export const oauthIntentOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure,
  path: '/',
  maxAge: oauthIntentLifetime,
} as const;

type OAuthIntent = {
  provider: string;
  state: string;
  userId: string | null;
  expiresAt: number;
};

function signature(payload: string) {
  return createHmac('sha256', process.env.AUTH_SECRET ?? '')
    .update('contourstitch-oauth:')
    .update(payload)
    .digest();
}

export function sealOAuthIntent(
  provider: string,
  state: string,
  userId: string | null,
) {
  const intent: OAuthIntent = {
    provider,
    state,
    userId,
    expiresAt: Date.now() + oauthIntentLifetime * 1_000,
  };
  const payload = Buffer.from(JSON.stringify(intent)).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function readOAuthIntent(
  cookie: string | undefined,
  provider: string,
  state: string | null,
) {
  if (!cookie || !state) return null;

  const [payload, encodedSignature, extra] = cookie.split('.');
  if (!payload || !encodedSignature || extra !== undefined) return null;

  const supplied = Buffer.from(encodedSignature, 'base64url');
  const expected = signature(payload);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;

  try {
    const intent: OAuthIntent = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    );
    return intent.provider === provider &&
      intent.state === state &&
      intent.expiresAt > Date.now()
      ? intent
      : null;
  } catch {
    return null;
  }
}
