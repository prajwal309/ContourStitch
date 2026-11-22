'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication, currentUser, enabledProviders } from './auth';
import { database } from './db';
import { accountReturnPath } from './return-path';
import {
  oauthIntentCookie,
  oauthIntentOptions,
  sealOAuthIntent,
} from './oauth-intent';

export async function startOAuth(
  provider: string,
  expectedUserId: string | null,
  nextPath?: string,
) {
  if (!authentication || !enabledProviders.some(({ id }) => id === provider)) {
    redirect('/sign-in?error=Configuration');
  }

  const user = await currentUser();
  if ((user?.id ?? null) !== expectedUserId)
    redirect('/sign-in?error=OAuthSession');

  if (
    user &&
    (await database().account.findFirst({
      where: { userId: user.id, provider },
      select: { provider: true },
    }))
  ) {
    redirect(accountReturnPath(nextPath));
  }

  let destination: string;
  try {
    destination = await authentication.signIn(
      provider,
      { redirect: false, redirectTo: accountReturnPath(nextPath) },
      provider === 'google' ? { prompt: 'select_account' } : undefined,
    );
  } catch {
    redirect('/sign-in?error=OAuthSignin');
  }

  const url = new URL(destination, process.env.AUTH_URL);
  const providerOrigin =
    provider === 'google'
      ? 'https://accounts.google.com'
      : 'https://www.facebook.com';
  const state = url.searchParams.get('state');
  if (url.origin !== providerOrigin || !state)
    redirect('/sign-in?error=OAuthSignin');

  (await cookies()).set(
    oauthIntentCookie,
    sealOAuthIntent(provider, state, expectedUserId),
    oauthIntentOptions,
  );
  redirect(url.href);
}

export async function leaveAccount() {
  (await cookies()).delete(oauthIntentCookie);
  if (!authentication) redirect('/');
  await authentication.signOut({ redirectTo: '/' });
}
