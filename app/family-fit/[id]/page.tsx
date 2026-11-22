import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { signInFor } from '@/lib/auth/return-path';
import { profileDate } from '@/lib/accounts/dates';
import { invitationState } from '@/lib/family/invitation-state';
import { getCollection, getProduct, products } from '@/lib/shop/catalog';
import { fitProgress } from '@/lib/shop/fit';
import { ProductGrid } from '@/components/shop/ProductGrid';
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
      collectionKey: true,
      organizerId: true,
      _count: { select: { members: true } },
    },
  });
  if (!group) notFound();
  const isOrganizer = group.organizerId === user.id;
  const [selections, members, invites] = await Promise.all([
    db.outfitSelection.findMany({
      where: { groupId: id, ...(isOrganizer ? {} : { userId: user.id }) },
      select: {
        userId: true,
        productKey: true,
        variantKey: true,
        fitComplete: true,
        usesProfile: true,
        fitRevisionId: true,
      },
    }),
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
  const collection = getCollection(group.collectionKey);
  const ready = selections.filter(
    (selection) => fitProgress(selection) === 'Fit details entered',
  ).length;
  const byUser = new Map(
    selections.map((selection) => [selection.userId, selection]),
  );

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
        <p>
          {collection?.name ?? 'Shared collection'} · Demo outfit coordination
        </p>
      </header>
      <div className="studio-columns">
        <section className="studio-panel">
          <h2>{isOrganizer ? 'Group progress' : 'My outfit'}</h2>
          {isOrganizer && (
            <p>
              {selections.length} of {group._count.members} members selected an
              outfit. {ready} entered all fit details.
            </p>
          )}
          <p className="muted">
            The organizer can see member names, outfit choices and completion
            status. Individual dimensions, profiles and fit preferences stay
            private.
          </p>
          <ul className="studio-list">
            {members.map((member) => {
              const selection = byUser.get(member.userId);
              const product = selection && getProduct(selection.productKey);
              const variant = product?.variants.find(
                ({ key }) => key === selection?.variantKey,
              );
              const own = member.userId === user.id;
              return (
                <li key={member.userId}>
                  <div>
                    <strong>
                      {own ? 'You' : member.user.name || 'Group member'}
                    </strong>
                    <p className="muted">
                      {selection
                        ? `${product?.name ?? 'Saved outfit'}${variant ? ` · ${variant.color} · ${variant.fabric}` : ''} · ${fitProgress(selection)}`
                        : 'Choose an outfit below'}
                    </p>
                  </div>
                  {own && product && (
                    <Link
                      className="text-button"
                      href={`/shop/${product.key}?group=${id}`}
                    >
                      Edit my outfit
                    </Link>
                  )}
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
      <section className="studio-section">
        <h2>Choose from the shared collection</h2>
        <ProductGrid
          products={products.filter(
            ({ collectionKey }) => collectionKey === group.collectionKey,
          )}
          groupId={id}
        />
      </section>
    </main>
  );
}
