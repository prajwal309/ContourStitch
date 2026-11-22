import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, products } from '@/lib/shop/catalog';
import { ProductGrid } from '@/components/shop/ProductGrid';

export default async function Collection({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const collection = getCollection((await params).slug);
  if (!collection) notFound();

  return (
    <main id="main" className="market-page">
      <Link href="/shop" className="text-button">
        ← Shop
      </Link>
      <div className="collection-feature">
        <header className="market-heading">
          <p className="eyebrow">Wedding and occasion wear · Demo</p>
          <h1>{collection.name}</h1>
          <p>{collection.description}</p>
          <Link className="secondary-button" href="/family-fit">
            Open Family Fit Studio
          </Link>
        </header>
        <div className="catalog-image">
          <Image
            src={collection.cover}
            alt="Copper lehenga with an ivory dupatta"
            fill
            sizes="(max-width: 650px) 90vw, 420px"
          />
        </div>
      </div>
      <h2>Outfits in the collection</h2>
      <ProductGrid
        products={products.filter(
          ({ collectionKey }) => collectionKey === collection.key,
        )}
      />
    </main>
  );
}
