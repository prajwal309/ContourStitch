import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, enabledProviders } from '@/lib/auth/auth';
import { startOAuth, leaveAccount } from '@/lib/auth/actions';
import { signInFor } from '@/lib/auth/return-path';
import { database } from '@/lib/auth/db';
import { DisplayNameForm } from '@/components/accounts/DisplayNameForm';
import { PrivacySettings } from '@/components/consent/PrivacySettings';
import { readAcceptedVersions, readConsent } from '@/lib/consent/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Account | ContourStitch' };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect(signInFor('/account'));

  const [accounts, consent, acceptedVersions, passwordLogin] =
    await Promise.all([
      database().account.findMany({
        where: { userId: user.id },
        select: { provider: true },
      }),
      readConsent(user.id),
      readAcceptedVersions(user.id),
      database().passwordLogin.findUnique({
        where: { userId: user.id },
        select: { username: true },
      }),
    ]);

  return (
    <main id="main" className="market-page">
      <header className="market-heading">
        <h1>My Account</h1>
        <p>
          {user.name ? `Signed in as ${user.name}.` : 'You’re signed in.'}
          {user.email && <> {user.email}</>}
        </p>
        <div className="studio-actions">
          <Link href="/my-measurements" className="secondary-button">
            My Fit Profile
          </Link>
          <Link href="/family-fit" className="secondary-button">
            Family Fit Studio
          </Link>
        </div>
      </header>
      <div className="studio-columns">
        <section className="studio-panel">
          <DisplayNameForm userId={user.id} initialName={user.name ?? ''} />
        </section>
        <section className="studio-panel">
          <h2>Sign-in methods</h2>
          {passwordLogin && (
            <p>
              Username: <strong>{passwordLogin.username}</strong>
            </p>
          )}
          <div className="account-actions">
            {enabledProviders.map(({ id, name }) =>
              accounts.some(({ provider }) => provider === id) ? (
                <p className="muted" key={id}>
                  {name} connected
                </p>
              ) : (
                <form
                  action={startOAuth.bind(null, id, user.id, '/account')}
                  key={id}
                >
                  <button className="secondary-button" type="submit">
                    Connect {name}
                  </button>
                </form>
              ),
            )}
          </div>
          <form action={leaveAccount}>
            <button type="submit" className="text-button">
              Sign out
            </button>
          </form>
        </section>
      </div>
      <PrivacySettings
        userId={user.id}
        state={consent}
        acceptedVersions={acceptedVersions}
      />
    </main>
  );
}
