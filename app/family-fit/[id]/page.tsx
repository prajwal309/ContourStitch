import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { signInFor } from '@/lib/auth/return-path';
import { profileDate } from '@/lib/accounts/dates';
import { invitationState } from '@/lib/family/invitation-state';
import { InvitationPanel } from '@/components/family/GroupForms';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Family group | ContourStitch',
  robots: { index: false, follow: false },
};

export default async function Group({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-z0-9]{25}$/.test(id)) notFound();
  const user = await currentUser();
  if (!user) redirect(signInFor(`/family-fit/${id}`));

  const db = database();
  const group = await db.familyGroup.findUnique({
    where: { id, members: { some: { userId: user.id } } },
    select: {
      name: true,
      organizerId: true,
      _count: { select: { members: true } },
    },
  });
  if (!group) notFound();
  const isOrganizer = group.organizerId === user.id;
  const [members, invites] = await Promise.all([
    isOrganizer
      ? db.familyMembership.findMany({
          where: { groupId: id },
          orderBy: { joinedAt: 'asc' },
          select: { userId: true, user: { select: { name: true } } },
        })
      : Promise.resolve([{ userId: user.id, user: { name: user.name } }]),
    isOrganizer
      ? db.familyInvitation.findMany({
          where: { groupId: id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            expiresAt: true,
            redeemedAt: true,
            revokedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main id="main" className="market-page">
      <Link href="/family-fit" className="text-button">
        ← Family Fit Studio
      </Link>
      <header className="market-heading">
        <p className="eyebrow">
          {isOrganizer ? 'Organizer' : 'Member'} · {group._count.members}{' '}
          {group._count.members === 1 ? 'member' : 'members'}
        </p>
        <h1>{group.name}</h1>
      </header>
      <div className={isOrganizer ? 'studio-columns' : undefined}>
        <section className="studio-panel">
          <h2>{isOrganizer ? 'Group members' : 'Your membership'}</h2>
          <ul className="studio-list">
            {members.map((member) => (
              <li key={member.userId}>
                {member.userId === user.id
                  ? 'You'
                  : member.user.name || 'Group member'}
              </li>
            ))}
          </ul>
        </section>
        {isOrganizer && (
          <InvitationPanel
            userId={user.id}
            groupId={id}
            invitations={invites.map(
              ({ id, expiresAt, redeemedAt, revokedAt }) => ({
                id,
                expiry: profileDate(expiresAt),
                state: invitationState({ expiresAt, redeemedAt, revokedAt }),
              }),
            )}
          />
        )}
      </div>
    </main>
  );
}
