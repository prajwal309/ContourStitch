import 'server-only';

import { createHmac } from 'node:crypto';
import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { database, databaseUrl } from './db';
import { oauthIntentCookie, readOAuthIntent } from './oauth-intent';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { id: string };
  }
}

// https://developers.facebook.com/docs/graph-api/changelog/versions/
const facebookVersion = 'v26.0';
const providers = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          checks: ['pkce', 'state'],
          allowDangerousEmailAccountLinking: false,
        }),
      ]
    : []),
  ...(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET
    ? [
        Facebook({
          checks: ['state'],
          allowDangerousEmailAccountLinking: false,
          authorization: {
            url: `https://www.facebook.com/${facebookVersion}/dialog/oauth`,
          },
          token: `https://graph.facebook.com/${facebookVersion}/oauth/access_token`,
          userinfo: {
            async request({
              tokens,
              provider,
            }: {
              tokens: { access_token?: string };
              provider: { clientSecret?: string };
            }) {
              if (!tokens.access_token)
                throw new Error('Facebook access token missing.');
              const url = new URL(
                `https://graph.facebook.com/${facebookVersion}/me`,
              );
              url.searchParams.set('fields', 'id,name,email,picture');
              // https://developers.facebook.com/docs/graph-api/guides/secure-requests/
              url.searchParams.set(
                'appsecret_proof',
                createHmac('sha256', provider.clientSecret ?? '')
                  .update(tokens.access_token)
                  .digest('hex'),
              );
              const response = await fetch(url, {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
                cache: 'no-store',
              });
              if (!response.ok)
                throw new Error('Facebook profile unavailable.');
              return response.json();
            },
          },
          profile(profile) {
            if (!profile.id) throw new Error('Facebook account ID missing.');
            return {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              image: profile.picture?.data?.url,
            };
          },
        }),
      ]
    : []),
];

function appOrigin() {
  try {
    const url = new URL(process.env.AUTH_URL ?? '');
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    if (url.protocol === 'https:') return url.origin;
    if (url.protocol === 'http:' && url.hostname === 'localhost')
      return url.origin;
  } catch {
    return null;
  }
  return null;
}

const origin = appOrigin();
const secure = origin?.startsWith('https://') ?? false;
const sessionCookie = secure
  ? '__Host-authjs.session-token'
  : 'authjs.session-token';
const authConfigured =
  origin &&
  (process.env.AUTH_SECRET?.length ?? 0) >= 32 &&
  databaseUrl() &&
  providers.length;

export const authentication = authConfigured
  ? NextAuth((request) => {
      const db = database();
      const adapter = PrismaAdapter(db);
      const isOAuthCallback = request?.nextUrl.pathname.startsWith(
        '/api/auth/callback/',
      );
      const intent =
        isOAuthCallback && request
          ? readOAuthIntent(
              request.cookies.get(oauthIntentCookie)?.value,
              request.nextUrl.pathname.split('/').at(-1) ?? '',
              request.nextUrl.searchParams.get('state'),
            )
          : null;

      let oauthIdentity:
        | { type: string; provider: string; providerAccountId: string }
        | undefined;
      let createdUserId: string | undefined;

      return {
        adapter: {
          ...adapter,
          // Block account creation if a session expires during a linking attempt.
          async createUser(user) {
            if (!intent || intent.userId || !oauthIdentity)
              throw new Error('Account creation is unavailable.');
            // Create the first provider association atomically with the user.
            const { name, email, emailVerified, image } = user;
            const created = await db.user.create({
              data: {
                name,
                email,
                emailVerified,
                image,
                accounts: { create: oauthIdentity },
              },
            });
            createdUserId = created.id;
            return { ...created, email };
          },
          // Persist provider identity only and reject stale or switched sessions during linking.
          async linkAccount({ userId, type, provider, providerAccountId }) {
            if (createdUserId === userId) return;
            if (intent?.userId !== userId)
              throw new Error('Linking account changed.');
            await db.account.create({
              data: { userId, type, provider, providerAccountId },
            });
          },
          async getSessionAndUser(sessionToken) {
            const result = await adapter.getSessionAndUser?.(sessionToken);
            if (
              isOAuthCallback &&
              result &&
              result.session.expires.getTime() <= Date.now()
            )
              return null;
            return result ?? null;
          },
        },
        providers,
        cookies: {
          sessionToken: {
            name: sessionCookie,
            options: { httpOnly: true, sameSite: 'lax', path: '/', secure },
          },
        },
        session: {
          strategy: 'database',
          maxAge: 30 * 24 * 60 * 60,
          updateAge: 24 * 60 * 60,
        },
        pages: { signIn: '/sign-in', error: '/sign-in' },
        callbacks: {
          async signIn({ account }) {
            if (!intent || !account || intent.provider !== account.provider)
              return '/sign-in?error=OAuthSession';
            const sessionToken = request?.cookies.get(sessionCookie)?.value;
            const current = sessionToken
              ? await adapter.getSessionAndUser?.(sessionToken)
              : null;
            const activeId =
              current && current.session.expires.getTime() > Date.now()
                ? current.user.id
                : null;
            if (activeId !== intent.userId)
              return '/sign-in?error=OAuthSession';
            const { type, provider, providerAccountId } = account;
            oauthIdentity = { type, provider, providerAccountId };
            return true;
          },
          session({ session, user }) {
            return { ...session, user: { ...session.user, id: user.id } };
          },
        },
        // Provider and adapter errors can contain account details or credentials.
        logger: {
          error(error) {
            console.error('Authentication error', error.name);
          },
        },
      };
    })
  : null;

export const enabledProviders = authentication
  ? providers.map(({ id, name }) => ({ id, name }))
  : [];

export async function currentUser(): Promise<
  (DefaultSession['user'] & { id: string }) | null
> {
  const session = await authentication?.auth();
  return session?.user?.id ? session.user : null;
}
