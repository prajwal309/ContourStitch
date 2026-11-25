import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import { redirect } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { registerOAuth, startOAuth } from '@/lib/auth/actions';
import { currentUser, enabledProviders } from '@/lib/auth/auth';
import { accountReturnPath, agreementReviewPath } from '@/lib/auth/return-path';

import { AgreementFields } from '@/components/consent/AgreementFields';
import { accountAgreements, cameraAgreements } from '@/lib/consent/agreements';

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
  Configuration:
    'Account sign-in is temporarily unavailable. You can still measure and save on this device.',
};

export const metadata = { title: 'Sign in | ContourStitch' };

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; mode?: string }>;
}) {
  const { error, next, mode } = await searchParams;
  const returnPath = accountReturnPath(next);
  const user = await currentUser();
  if (user && !error) redirect(agreementReviewPath(returnPath));
  const register = mode === 'register' && !user && enabledProviders.length > 0;
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
        <h1>{register ? 'Create an account' : 'Sign in'}</h1>
        {register && <p>Your body. Your data. Your choice.</p>}
        <p>
          Save your fit profiles and open them on any device. Only measurements
          you choose to save to your account are uploaded. Camera video stays in
          your browser.
        </p>
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
            {register ? (
              <>
                <form
                  action={registerOAuth.bind(null, returnPath)}
                  className="sign-in-actions"
                >
                  <AgreementFields
                    types={[...cameraAgreements, ...accountAgreements]}
                    showOptional
                  />
                  {providerButtons}
                </form>
                <Link href={`/sign-in?${nextQuery}`} className="text-button">
                  Already have an account? Sign in
                </Link>
              </>
            ) : (
              <>
                {enabledProviders.map(({ id }, index) => (
                  <form
                    action={startOAuth.bind(null, id, null, returnPath)}
                    key={id}
                  >
                    {providerButtons[index]}
                  </form>
                ))}
                {enabledProviders.length > 0 && (
                  <Link
                    href={`/sign-in?mode=register&${nextQuery}`}
                    className="text-button"
                  >
                    Create an account
                  </Link>
                )}
              </>
            )}
            {!enabledProviders.length && (
              <p className="muted">Account sign-in is currently unavailable.</p>
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
