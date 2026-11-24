import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { signInFor } from '@/lib/auth/return-path';
import { profileDate } from '@/lib/accounts/dates';
import { invitationState } from '@/lib/family/invitation-state';
import { InvitationPanel } from '@/components/family/GroupForms';
import { MeasurementSharing } from '@/components/family/MeasurementSharing';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { labels } from '@/lib/measurement/types';
import { displayValue } from '@/lib/measurement/units';

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
      occasion: true,
      organizerId: true,
      organizer: { select: { name: true } },
      _count: { select: { members: true } },
    },
  });
  if (!group) notFound();
  const isOrganizer = group.organizerId === user.id;
  const [members, invites, shares, profiles] = await Promise.all([
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
    db.familyProfileShare.findMany({
      where: {
        groupId: id,
        organizerId: group.organizerId,
        membership: { group: { organizerId: group.organizerId } },
        ...(isOrganizer ? {} : { memberId: user.id }),
      },
      select: {
        memberId: true,
        revision: {
          select: {
            version: true,
            recordedAt: true,
            unit: true,
            estimates: true,
            corrections: true,
            missing: true,
          },
        },
      },
    }),
    isOrganizer
      ? Promise.resolve([])
      : db.measurementProfile.findMany({
          where: { userId: user.id },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: {
            revisions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { id: true, version: true, recordedAt: true },
            },
          },
        }),
  ]);
  const shared = new Map(
    shares.map(({ memberId, revision }) => [memberId, revision]),
  );
  const label = ({
    version,
    recordedAt,
  }: {
    version: number;
    recordedAt: Date;
  }) => `${profileDate(recordedAt)} · Version ${version}`;

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
        {group.occasion && <p>{group.occasion}</p>}
      </header>
      <div className={isOrganizer ? 'studio-columns' : undefined}>
        <section className="studio-panel">
          <h2>{isOrganizer ? 'Group members' : 'Your membership'}</h2>
          <ul className="studio-list">
            {members.map((member) => {
              const revision = shared.get(member.userId);
              const profile =
                isOrganizer && revision && restoreProfile(revision);
              return (
                <li key={member.userId}>
                  <div>
                    <strong>
                      {member.userId === user.id
                        ? 'You'
                        : member.user.name || 'Group member'}
                    </strong>
                    {profile && revision && (
                      <details className="revision-detail">
                        <summary>
                          Shared measurements · {label(revision)}
                        </summary>
                        <dl className="measurement-requirements">
                          {profile.report.estimates.map(({ key, valueCm }) => (
                            <div key={key}>
                              <dt>{labels[key]}</dt>
                              <dd>
                                {displayValue(valueCm, profile.unit)}{' '}
                                {profile.unit}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
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
      {!isOrganizer && (
        <MeasurementSharing
          groupId={id}
          userId={user.id}
          organizerId={group.organizerId}
          organizerName={group.organizer.name || 'the group organizer'}
          choices={profiles.flatMap(({ revisions }, index) =>
            revisions.map((revision) => ({
              id: revision.id,
              label: `${index === 0 ? 'Latest profile' : `Profile ${index + 1}`} · ${label(revision)}`,
            })),
          )}
          active={shares[0] ? label(shares[0].revision) : null}
        />
      )}
    </main>
  );
}
