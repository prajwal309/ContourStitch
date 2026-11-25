import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import { redirect } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { registerOAuth, startOAuth } from '@/lib/auth/actions';
import {
  accountSignInEnabled,
  currentUser,
  enabledProviders,
} from '@/lib/auth/auth';
import { accountReturnPath, agreementReviewPath } from '@/lib/auth/return-path';

import { RegistrationAgreementFields } from '@/components/consent/AgreementFields';
import {
  accountFailure,
  configurationFeedback,
} from '@/lib/auth/access-errors';
import { PasswordForm } from '@/components/accounts/PasswordForm';

const googleSans = localFont({
  src: '../fonts/google-sans.woff2',
  weight: '500',
  variable: '--type-google',
  display: 'swap',
});

const providerMarks: Record<string, string> = {
  google: '/identity/google.png',
  facebook: '/identity/facebook.png',
};

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    'This sign-in is already associated with an account. Use your original provider, then connect another provider from My Account.',
  OAuthCallbackError:
    'Sign-in was cancelled or the provider could not complete it. Please try again.',
  OAuthSignin: 'Could not connect to the sign-in provider. Please try again.',
  AccessDenied: 'Sign-in was declined. Please try again when you’re ready.',
  OAuthSession:
    'This sign-in request expired or your session changed. Please start again.',
  Agreements:
    'Review and accept the current required agreements to create an account.',
  RegistrationRequired:
    'This sign-in method has no linked account. To create an account, review the agreements below. To connect another provider to an existing account, sign in with your original provider first.',
  Configuration: configurationFeedback.error,
  SignOut:
    'This browser cleared the sign-in cookie, but we could not confirm the session ended. Try again shortly.',
};

export const metadata = { title: 'Sign in | ContourStitch' };

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    mode?: string;
    method?: string;
    notice?: string;
  }>;
}) {
  const { error, next, mode, method, notice } = await searchParams;
  const returnPath = accountReturnPath(next);
  const { user, sessionError } = await currentUser().then(
    (user) => ({ user, sessionError: undefined }),
    (error: unknown) => ({
      user: null,
      sessionError: accountFailure('read-sign-in-session', error).error,
    }),
  );
  if (user && !error) redirect(agreementReviewPath(returnPath));
  const register = mode === 'register' && !user && accountSignInEnabled;
  const recover = mode === 'recover' && !user && accountSignInEnabled;
  const providerRegistration =
    register && method === 'provider' && enabledProviders.length > 0;
  const nextQuery = `next=${encodeURIComponent(returnPath)}`;
  const providerButtons = enabledProviders.map(({ id, name }) => (
    <button
      key={id}
      name="provider"
      value={id}
      className={`provider-button provider-button--${id}`}
      type="submit"
    >
      {providerMarks[id] && (
        <Image src={providerMarks[id]} width={18} height={18} alt="" />
      )}
      Continue with {name}
    </button>
  ));

  return (
    <main id="main" className="flow">
      <section className={`flow-card sign-in-card ${googleSans.variable}`}>
        <LockKeyhole className="privacy-icon" aria-hidden="true" />
        <h1>
          {register
            ? 'Create an account'
            : recover
              ? 'Reset your password'
              : 'Sign in'}
        </h1>
        {recover && (
          <p>
            Use the one-time code saved from My Account. If you sign in through
            a provider, recover access there.
          </p>
        )}
        {!recover && <p>Save your fit profiles and open them on any device.</p>}
        {notice === 'PasswordReset' && (
          <p role="status">Password updated. Sign in with your new password.</p>
        )}
        {sessionError && (
          <p role="alert" className="error">
            {sessionError}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {Object.hasOwn(errorMessages, error)
              ? errorMessages[error]
              : 'Sign-in could not be completed. Please try again.'}
          </p>
        )}
        {user ? (
          <Link className="button" href="/my-measurements">
            Return to My Fit Profile
          </Link>
        ) : (
          <div className="sign-in-actions">
            {accountSignInEnabled ? (
              <>
                {providerRegistration ? (
                  <form
                    action={registerOAuth.bind(null, returnPath)}
                    className="agreement-flow"
                  >
                    <RegistrationAgreementFields />
                    {providerButtons}
                  </form>
                ) : (
                  <PasswordForm
                    key={
                      register ? 'register' : recover ? 'recover' : 'sign-in'
                    }
                    mode={
                      register ? 'register' : recover ? 'recover' : 'sign-in'
                    }
                    next={returnPath}
                  />
                )}
                {!register &&
                  !recover &&
                  enabledProviders.map(({ id }, index) => (
                    <form
                      action={startOAuth.bind(null, id, null, returnPath)}
                      key={id}
                    >
                      {providerButtons[index]}
                    </form>
                  ))}
                {register && enabledProviders.length > 0 && (
                  <Link
                    href={`/sign-in?mode=register&${providerRegistration ? '' : 'method=provider&'}${nextQuery}`}
                    className="text-button"
                  >
                    {providerRegistration
                      ? 'Create an account with a password'
                      : 'Create an account with a sign-in provider'}
                  </Link>
                )}
                <Link
                  href={`/sign-in?${register || recover ? '' : 'mode=register&'}${nextQuery}`}
                  className="text-button"
                >
                  {register
                    ? 'Already have an account? Sign in'
                    : recover
                      ? 'Back to sign in'
                      : 'Create an account'}
                </Link>
              </>
            ) : (
              <p className="muted">{configurationFeedback.error}</p>
            )}
            <Link className="text-button" href="/measure">
              Continue as a guest
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
