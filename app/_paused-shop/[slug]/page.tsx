import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { signInFor } from '@/lib/auth/return-path';
import {
  getCollection,
  getProduct,
  measurementDefinition,
} from '@/lib/shop/catalog';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { profileDate } from '@/lib/accounts/dates';
import { OutfitForm, type FitChoice } from '@/components/shop/OutfitForm';

export const dynamic = 'force-dynamic';

const revisionFields = {
  id: true,
  version: true,
  unit: true,
  estimates: true,
  corrections: true,
  missing: true,
  recordedAt: true,
} as const;

function option(
  revision: Parameters<typeof restoreProfile>[0] & {
    id: string;
    recordedAt: Date;
  },
  prefix: string,
): FitChoice | null {
  const profile = restoreProfile(revision);
  return profile
    ? {
        id: revision.id,
        label: `${prefix} · ${profileDate(revision.recordedAt)}`,
        keys: profile.report.estimates.map(({ key }) => key),
      }
    : null;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ group?: string | string[] }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const collection = getCollection(product.collectionKey);
  const { group } = await searchParams;
  if (
    group !== undefined &&
    (typeof group !== 'string' || !/^[a-z0-9]{25}$/.test(group))
  )
    notFound();
  const groupId = group ?? null;
  const user = await currentUser();

  const member =
    groupId && user
      ? await database().familyMembership.findUnique({
          where: {
            groupId_userId: { groupId, userId: user.id },
            group: { collectionKey: product.collectionKey },
          },
          select: { group: { select: { name: true } } },
        })
      : null;
  if (groupId && user && !member) notFound();

  const [profiles, selection] = user
    ? await Promise.all([
        database().measurementProfile.findMany({
          where: { userId: user.id },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: {
            revisions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: revisionFields,
            },
          },
        }),
        database().outfitSelection.findUnique({
          where: {
            userId_scopeKey: {
              userId: user.id,
              scopeKey: groupId
                ? `group:${groupId}`
                : `personal:${product.key}`,
            },
          },
          select: {
            productKey: true,
            variantKey: true,
            preference: true,
            extraCm: true,
            fitRevision: { select: revisionFields },
          },
        }),
      ])
    : [[], null];
  const choices = profiles.flatMap(({ revisions }, index) => {
    const result =
      revisions[0] &&
      option(
        revisions[0],
        index === 0 ? 'Latest fit profile' : 'Saved fit profile',
      );
    return result ? [result] : [];
  });
  const existing = selection?.productKey === product.key ? selection : null;
  if (
    existing?.fitRevision &&
    !choices.some(({ id }) => id === existing.fitRevision?.id)
  ) {
    const pinned = option(existing.fitRevision, 'Previously selected revision');
    if (pinned) choices.push(pinned);
  }

  return (
    <main id="main" className="market-page">
      <Link
        href={
          member
            ? `/family-fit/${groupId}`
            : `/shop/collections/${product.collectionKey}`
        }
        className="text-button"
      >
        ← {member ? member.group.name : (collection?.name ?? 'Collections')}
      </Link>
      <div className="product-layout">
        <figure>
          <div className="catalog-image">
            <Image
              src={product.image}
              alt={product.imageAlt}
              fill
              sizes="(max-width: 700px) 90vw, 540px"
              preload
            />
          </div>
          <figcaption className="muted">
            Illustrative product photograph · Demo design
          </figcaption>
        </figure>
        <div>
          <header className="market-heading">
            <p className="eyebrow">
              {product.age} · {product.style} · Demo
            </p>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
            <p className="muted">
              Preview colors ·{' '}
              {[...new Set(product.variants.map(({ color }) => color))].join(
                ' / ',
              )}
            </p>
            <p className="muted">
              Preview fabrics ·{' '}
              {[...new Set(product.variants.map(({ fabric }) => fabric))].join(
                ' / ',
              )}
            </p>
          </header>
          <section className="studio-panel">
            <h2>What this outfit needs</h2>
            <dl className="measurement-requirements">
              {product.requirements.map((key) => {
                const definition = measurementDefinition(key);
                return (
                  <div key={key}>
                    <dt>{definition.label}</dt>
                    <dd>{definition.kind === 'body' ? 'Body' : 'Garment'}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="muted">
              Body measurements describe the wearer. Garment dimensions describe
              the finished piece. Allowances and size recommendations are
              reserved for a fitting.
            </p>
            {user ? (
              <OutfitForm
                key={`${product.key}:${groupId ?? 'personal'}`}
                userId={user.id}
                product={product}
                groupId={groupId}
                profiles={choices}
                existing={
                  existing
                    ? {
                        revisionId: existing.fitRevision?.id ?? null,
                        variant: existing.variantKey,
                        preference: existing.preference,
                        extra: existing.extraCm as Record<string, number>,
                      }
                    : undefined
                }
              />
            ) : (
              <Link className="button" href={signInFor(`/shop/${product.key}`)}>
                Sign in to use my fit
              </Link>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
