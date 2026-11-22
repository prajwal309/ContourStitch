import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, enabledProviders } from '@/lib/auth/auth';
import { startOAuth, leaveAccount } from '@/lib/auth/actions';
import { signInFor } from '@/lib/auth/return-path';
import { database } from '@/lib/auth/db';
import { getProduct } from '@/lib/shop/catalog';
import { fitProgress } from '@/lib/shop/fit';
import { RemoveOutfit } from '@/components/shop/RemoveOutfit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Account | ContourStitch' };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect(signInFor('/account'));

  const db = database();
  const [accounts, selections] = await Promise.all([
    db.account.findMany({
      where: { userId: user.id },
      select: { provider: true },
    }),
    db.outfitSelection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        groupId: true,
        productKey: true,
        variantKey: true,
        fitComplete: true,
        usesProfile: true,
        fitRevisionId: true,
        group: { select: { name: true } },
      },
    }),
  ]);

  return (
    <main id="main" className="market-page">
      <header className="market-heading">
        <h1>My Account</h1>
        <p>
          {user.name ? `Signed in as ${user.name}.` : 'You’re signed in.'}
          {user.email && <> {user.email}</>}
        </p>
        <div className="studio-actions">
          <Link href="/my-measurements" className="secondary-button">
            My Fit Profile
          </Link>
          <Link href="/family-fit" className="secondary-button">
            Family Fit Studio
          </Link>
        </div>
      </header>
      <div className="studio-columns">
        <section className="studio-panel">
          <h2>Saved outfits</h2>
          <p>
            Return to your saved outfit previews and update their fit details.
          </p>
          {selections.length ? (
            <ul className="studio-list">
              {selections.map((selection) => {
                const product = getProduct(selection.productKey);
                const variant = product?.variants.find(
                  ({ key }) => key === selection.variantKey,
                );
                return (
                  <li key={selection.id}>
                    <div>
                      {product ? (
                        <Link
                          className="inline-link"
                          href={`/shop/${product.key}${selection.groupId ? `?group=${selection.groupId}` : ''}`}
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <strong>Saved outfit</strong>
                      )}
                      <p className="muted">
                        {selection.group?.name ?? 'Personal selection'}
                        {variant &&
                          ` · ${variant.color} · ${variant.fabric}`} ·{' '}
                        {fitProgress(selection)}
                      </p>
                    </div>
                    <RemoveOutfit userId={user.id} id={selection.id} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Link className="text-button" href="/shop">
              Explore the collection →
            </Link>
          )}
        </section>
        <section className="studio-panel">
          <h2>Sign-in methods</h2>
          <div className="account-actions">
            {enabledProviders.map(({ id, name }) =>
              accounts.some(({ provider }) => provider === id) ? (
                <p className="muted" key={id}>
                  {name} connected
                </p>
              ) : (
                <form
                  action={startOAuth.bind(null, id, user.id, '/account')}
                  key={id}
                >
                  <button className="secondary-button" type="submit">
                    Connect {name}
                  </button>
                </form>
              ),
            )}
          </div>
          <form action={leaveAccount}>
            <button type="submit" className="text-button">
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
