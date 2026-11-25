import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CloudProfileEditor } from '@/components/accounts/CloudProfileEditor';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { requireAgreedAccount } from '@/lib/consent/access';
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
  const user = await requireAgreedAccount(`/my-measurements/${id}`);

  const saved = await database().measurementProfile.findFirst({
    where: { id, userId: user.id },
    include: {
      revisions: {
        orderBy: { version: 'desc' },
        include: { measurements: { orderBy: { key: 'asc' } } },
      },
    },
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
          <p>
            Each saved revision is a confirmed measurement session. Older
            sessions show how each recorded value differs from the latest.
          </p>
          {saved.revisions.length > 0 &&
            (() => {
              const latest = saved.revisions[0];
              const latestValues = new Map(
                latest.measurements.map(({ key, valueCm }) => [key, valueCm]),
              );
              return saved.revisions.map((revision) => (
                <details className="revision-detail" key={revision.id}>
                  <summary>
                    <time dateTime={revision.recordedAt.toISOString()}>
                      {profileDate(revision.recordedAt)}
                    </time>
                    {revision.version === saved.version && ' · Current'}
                  </summary>
                  <dl className="measurement-requirements">
                    {revision.measurements.map((measurement) => {
                      const latestValue = latestValues.get(measurement.key);
                      const difference =
                        revision.id !== latest.id && latestValue !== undefined
                          ? measurement.valueCm - latestValue
                          : null;
                      const comparisonUnit = latest?.unit ?? revision.unit;
                      return (
                        <div key={measurement.key}>
                          <dt>{labels[measurement.key]}</dt>
                          <dd>
                            {displayValue(measurement.valueCm, revision.unit)}{' '}
                            {revision.unit}
                          </dd>
                          <dd className="muted">
                            {measurement.uncertaintyCm === null
                              ? 'No validated uncertainty interval'
                              : `± ${displayValue(measurement.uncertaintyCm, revision.unit)} ${revision.unit}`}{' '}
                            · Model confidence: {measurement.confidence}
                          </dd>
                          {difference !== null && (
                            <dd className="muted">
                              Change from latest: {difference > 0 ? '+' : ''}
                              {displayValue(
                                Math.abs(difference),
                                comparisonUnit,
                              )}{' '}
                              {comparisonUnit}
                            </dd>
                          )}
                          <dd className="muted">{measurement.method}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </details>
              ));
            })()}
        </section>
      </section>
    </main>
  );
}
