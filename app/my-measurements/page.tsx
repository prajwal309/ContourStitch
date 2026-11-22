import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CloudProfileSources } from '@/components/accounts/CloudProfileSources';
import { profileDate } from '@/lib/accounts/dates';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { products } from '@/lib/shop/catalog';
import { compatibility } from '@/lib/shop/fit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Fit Profile | ContourStitch' };

export default async function MyFitProfile() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const db = database();
  const profiles = await db.measurementProfile.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, createdAt: true, updatedAt: true, unit: true },
  });
  const latest = profiles[0]
    ? await db.measurementProfile.findUnique({
        where: { id: profiles[0].id, userId: user.id },
        select: {
          unit: true,
          estimates: true,
          corrections: true,
          missing: true,
        },
      })
    : null;
  const keys = latest
    ? (restoreProfile(latest)?.report.estimates.map(({ key }) => key) ?? [])
    : [];

  return (
    <main id="main" className="flow results-flow">
      <section className="flow-card">
        <p className="eyebrow">Measure once. Wear everywhere.</p>
        <h1>My Fit Profile</h1>
        <p>
          {user.name ? `Signed in as ${user.name}. ` : ''}Your saved body
          measurements can be reused across collections. Review them when your
          body changes or a garment calls for more detail.
        </p>
        <CloudProfileSources key={user.id} userId={user.id} />
        <section className="account-section" aria-labelledby="saved-profiles">
          <h2 id="saved-profiles">Saved profiles</h2>
          {profiles.length ? (
            <ul className="cloud-profile-list">
              {profiles.map(({ id, createdAt, updatedAt, unit }, index) => (
                <li key={id}>
                  <Link
                    href={`/my-measurements/${id}`}
                    prefetch={false}
                    className="cloud-profile-link"
                  >
                    <strong>
                      {index === 0 ? (
                        'Latest profile'
                      ) : (
                        <>
                          Profile from{' '}
                          <time dateTime={createdAt.toISOString()}>
                            {profileDate(createdAt)}
                          </time>
                        </>
                      )}
                    </strong>
                    <span className="muted">
                      Recorded{' '}
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
        {!!keys.length && (
          <section className="account-section">
            <h2>Use your fit when you shop</h2>
            <p>
              The shop offers your latest profile first. Each outfit shows which
              recorded dimensions it can reuse.
            </p>
            <ul className="studio-list">
              {products.map((product) => {
                const match = compatibility(product.requirements, keys);
                return (
                  <li key={product.key}>
                    <Link className="inline-link" href={`/shop/${product.key}`}>
                      {product.name}
                    </Link>
                    <span className="muted">
                      {match.fromProfile.length} of{' '}
                      {product.requirements.length} recorded
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
