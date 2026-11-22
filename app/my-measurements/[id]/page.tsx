import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CloudProfileEditor } from '@/components/accounts/CloudProfileEditor';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';

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
  });
  if (!saved) notFound();

  const profile = restoreProfile(saved);

  return (
    <main id="main" className="flow results-flow">
      <section className="flow-card">
        <Link className="text-button" href="/my-measurements" prefetch={false}>
          ← My Measurements
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
      </section>
    </main>
  );
}
