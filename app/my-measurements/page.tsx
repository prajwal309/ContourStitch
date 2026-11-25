import { measurementCopy } from '@/lib/measurement/copy';
import Link from 'next/link';
import { CloudProfileSources } from '@/components/accounts/CloudProfileSources';
import { profileDate } from '@/lib/accounts/dates';
import { requireAgreedAccount } from '@/lib/consent/access';
import { database } from '@/lib/auth/db';
import { brand } from '@/lib/brand';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Fit Profile | ContourStitch' };

export default async function MyFitProfile() {
  const user = await requireAgreedAccount('/my-measurements');

  const db = database();
  const profiles = await db.measurementProfile.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, createdAt: true, updatedAt: true, unit: true },
  });
  return (
    <main id="main" className="flow results-flow">
      <section className="flow-card">
        <p className="muted">{brand.tagline}</p>
        <h1>My Fit Profile</h1>
        <p>
          {user.name ? `Signed in as ${user.name}. ` : ''}Reuse your saved body
          measurements for future fittings. Review them when your body changes
          or a garment calls for more detail.
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
            {measurementCopy.camera} →
          </Link>
        </section>
      </section>
    </main>
  );
}
