import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CloudProfileEditor } from '@/components/accounts/CloudProfileEditor';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { profileDate } from '@/lib/accounts/dates';
import { labels } from '@/lib/measurement/types';
import { displayValue } from '@/lib/measurement/units';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saved profile | ContourStitch' };

export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const saved = await database().measurementProfile.findFirst({
    where: { id, userId: user.id },
    include: { revisions: { orderBy: { version: 'desc' } } },
  });
  if (!saved) notFound();

  const profile = restoreProfile(saved);

  return (
    <main id="main" className="flow results-flow">
      <section className="flow-card">
        <Link className="text-button" href="/my-measurements" prefetch={false}>
          ← My Fit Profile
        </Link>
        <h1>Saved profile</h1>
        {profile ? (
          <CloudProfileEditor
            key={saved.id}
            profile={profile}
            userId={user.id}
            id={id}
            version={saved.version}
            updatedAt={saved.updatedAt.toISOString()}
          />
        ) : (
          <p role="alert">This profile couldn’t be opened.</p>
        )}
        <section className="account-section">
          <h2>Measurement history</h2>
          <p>Your past revisions show what you had recorded on each date.</p>
          {saved.revisions.map((revision) => {
            const recorded = restoreProfile(revision);
            if (!recorded) return null;
            return (
              <details className="revision-detail" key={revision.id}>
                <summary>
                  <time dateTime={revision.recordedAt.toISOString()}>
                    {profileDate(revision.recordedAt)}
                  </time>
                  {revision.version === saved.version && ' · Current'}
                </summary>
                <dl className="measurement-requirements">
                  {recorded.report.estimates.map(({ key, valueCm }) => (
                    <div key={key}>
                      <dt>{labels[key]}</dt>
                      <dd>
                        {displayValue(valueCm, recorded.unit)} {recorded.unit}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            );
          })}
        </section>
      </section>
    </main>
  );
}
