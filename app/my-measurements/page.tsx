import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CloudProfileSources } from '@/components/accounts/CloudProfileSources';
import { profileDate } from '@/lib/accounts/dates';
import { leaveAccount, startOAuth } from '@/lib/auth/actions';
import { currentUser, enabledProviders } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Measurements | ContourStitch' };

export default async function MyMeasurements() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const db = database();
  const [profiles, accounts] = await Promise.all([
    db.measurementProfile.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true, updatedAt: true, unit: true },
    }),
    db.account.findMany({
      where: { userId: user.id },
      select: { provider: true },
    }),
  ]);

  return (
    <main id="main" className="flow results-flow">
      <section className="flow-card">
        <p className="eyebrow">YOUR CONTOURSTITCH ACCOUNT</p>
        <h1>My Measurements</h1>
        <p>
          {user.name ? `Signed in as ${user.name}.` : 'You’re signed in.'} Your
          saved fit profiles are available on any device.
        </p>
        <CloudProfileSources key={user.id} userId={user.id} />
        <section className="account-section" aria-labelledby="saved-profiles">
          <h2 id="saved-profiles">Saved profiles</h2>
          {profiles.length ? (
            <ul className="cloud-profile-list">
              {profiles.map(({ id, createdAt, updatedAt, unit }) => (
                <li key={id}>
                  <Link
                    href={`/my-measurements/${id}`}
                    prefetch={false}
                    className="cloud-profile-link"
                  >
                    <strong>
                      Profile from{' '}
                      <time dateTime={createdAt.toISOString()}>
                        {profileDate(createdAt)}
                      </time>
                    </strong>
                    <span className="muted">
                      Updated{' '}
                      <time dateTime={updatedAt.toISOString()}>
                        {profileDate(updatedAt)}
                      </time>{' '}
                      · {unit === 'cm' ? 'Centimetres' : 'Inches'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              You haven’t saved a profile to your account yet.
            </p>
          )}
          <Link className="text-button" href="/measure">
            Start a new measurement →
          </Link>
        </section>
        <section className="account-section" aria-labelledby="account-sign-in">
          <h2 id="account-sign-in">Sign-in methods</h2>
          <div className="account-actions">
            {enabledProviders.map(({ id, name }) =>
              accounts.some(({ provider }) => provider === id) ? (
                <p key={id} className="muted">
                  {name} connected
                </p>
              ) : (
                <form action={startOAuth.bind(null, id, user.id)} key={id}>
                  <button className="secondary-button" type="submit">
                    Connect {name}
                  </button>
                </form>
              ),
            )}
          </div>
          <form action={leaveAccount}>
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
