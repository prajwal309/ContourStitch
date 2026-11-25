'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication, currentUser, enabledProviders } from './auth';
import { accountFailure } from './access-errors';
import { revokeDatabaseSession } from './sessions';
import { database } from './db';
import { accountReturnPath, agreementReviewPath } from './return-path';
import {
  oauthIntentCookie,
  oauthIntentOptions,
  sealOAuthIntent,
} from './oauth-intent';

import {
  checkedRegistrationVersions,
  matchesVersions,
  validRegistrationVersions,
  type ConsentVersions,
} from '@/lib/consent/agreements';
import { hasAccountAgreements } from '@/lib/consent/store';

export async function registerOAuth(nextPath: string, form: FormData) {
  const provider = form.get('provider');
  const versions = checkedRegistrationVersions(form);
  if (
    typeof provider !== 'string' ||
    !validRegistrationVersions(versions) ||
    (form.has('IMPROVEMENT') && !matchesVersions(versions, ['IMPROVEMENT']))
  ) {
    redirect(
      `/sign-in?mode=register&method=provider&error=Agreements&next=${encodeURIComponent(accountReturnPath(nextPath))}`,
    );
  }
  await beginOAuth(provider, null, nextPath, versions);
}

export async function startOAuth(
  provider: string,
  expectedUserId: string | null,
  nextPath?: string,
) {
  await beginOAuth(provider, expectedUserId, nextPath);
}

async function beginOAuth(
  provider: string,
  expectedUserId: string | null,
  nextPath?: string,
  registration?: ConsentVersions,
) {
  if (!authentication || !enabledProviders.some(({ id }) => id === provider)) {
    redirect('/sign-in?error=Configuration');
  }

  const user = await currentUser();
  if ((user?.id ?? null) !== expectedUserId)
    redirect('/sign-in?error=OAuthSession');

  if (user && !(await hasAccountAgreements(user.id)))
    redirect(agreementReviewPath(accountReturnPath(nextPath)));

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
      {
        redirect: false,
        redirectTo: agreementReviewPath(accountReturnPath(nextPath)),
      },
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
    sealOAuthIntent(
      provider,
      state,
      expectedUserId,
      accountReturnPath(nextPath),
      registration,
    ),
    oauthIntentOptions,
  );
  redirect(url.href);
}

export async function leaveAccount() {
  (await cookies()).delete(oauthIntentCookie);
  try {
    await revokeDatabaseSession();
  } catch (error) {
    accountFailure('sign-out', error);
    redirect('/sign-in?error=SignOut');
  }
  redirect('/');
}
