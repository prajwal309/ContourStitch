import Link from 'next/link';
import { CreateGroupForm } from '@/components/family/GroupForms';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { signInFor } from '@/lib/auth/return-path';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Family Fit Studio | ContourStitch' };

export default async function FamilyFit() {
  const user = await currentUser();
  const groups = user
    ? await database().familyMembership.findMany({
        where: { userId: user.id },
        orderBy: { joinedAt: 'desc' },
        select: {
          group: {
            select: {
              id: true,
              name: true,
              organizerId: true,
            },
          },
        },
      })
    : [];

  return (
    <main id="main" className="market-page">
      <header className="market-heading">
        <p className="eyebrow">Weddings and celebrations</p>
        <h1>Family Fit Studio</h1>
        <p>
          Create a private group and invite family members to your next fitting.
        </p>
      </header>
      {user ? (
        <div className="studio-columns">
          <section className="studio-panel">
            <h2>Your groups</h2>
            {groups.length ? (
              <ul className="cloud-profile-list">
                {groups.map(({ group }) => (
                  <li key={group.id}>
                    <Link
                      className="cloud-profile-link"
                      href={`/family-fit/${group.id}`}
                      prefetch={false}
                    >
                      <strong>{group.name}</strong>
                      <span className="muted">
                        {group.organizerId === user.id ? 'Organizer' : 'Member'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Create your first group or open an invitation from a family
                member.
              </p>
            )}
            <Link className="text-button" href="/family-fit/invite">
              Resume an invitation →
            </Link>
          </section>
          <section className="studio-panel">
            <CreateGroupForm userId={user.id} />
          </section>
        </div>
      ) : (
        <div className="studio-panel">
          <h2>Plan a family fitting</h2>
          <p>
            Sign in to create a private group. Each member controls their own
            fit profile.
          </p>
          <Link href={signInFor('/family-fit')} className="button">
            Sign in to get started
          </Link>
        </div>
      )}
    </main>
  );
}
