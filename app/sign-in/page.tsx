import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import { redirect } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { startOAuth } from '@/lib/auth/actions';
import { currentUser, enabledProviders } from '@/lib/auth/auth';
import { accountReturnPath } from '@/lib/auth/return-path';

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
  AccessDenied: 'Sign-in was declined. Please try again when you’re ready.',
  OAuthSession:
    'This sign-in request expired or your session changed. Please start again.',
  Configuration:
    'Account sign-in is temporarily unavailable. You can still measure and save on this device.',
};

export const metadata = { title: 'Sign in | ContourStitch' };

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const returnPath = accountReturnPath(next);
  const user = await currentUser();
  if (user && !error) redirect(returnPath);

  return (
    <main id="main" className="flow">
      <section className={`flow-card sign-in-card ${googleSans.variable}`}>
        <LockKeyhole className="privacy-icon" aria-hidden="true" />
        <h1>Sign in</h1>
        <p>
          Save your fit profiles and open them on any device. Only measurements
          you choose to save to your account are uploaded. Your photos stay in
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
            {enabledProviders.map(({ id, name }) => (
              <form
                action={startOAuth.bind(null, id, null, returnPath)}
                key={id}
              >
                <button
                  className={`provider-button provider-button--${id}`}
                  type="submit"
                >
                  {providerMarks[id] && (
                    <Image
                      src={providerMarks[id]}
                      width={18}
                      height={18}
                      alt=""
                    />
                  )}
                  Continue with {name}
                </button>
              </form>
            ))}
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
