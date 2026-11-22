import Link from 'next/link';
import { collections, facets, filterCatalog } from '@/lib/shop/catalog';
import { ProductGrid } from '@/components/shop/ProductGrid';

export const metadata = { title: 'Shop Collections | ContourStitch' };

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalog = filterCatalog(await searchParams);
  return (
    <main id="main" className="market-page">
      <header className="market-heading">
        <p className="eyebrow">The ContourStitch collection</p>
        <h1>Dress for the occasion.</h1>
        <p>
          Start with a saved fit profile and explore coordinated wedding wear
          for adults and children. Demonstration designs are available to save
          as outfit selections.
        </p>
      </header>
      <section className="collection-banner" aria-label="Collections">
        {collections.map((collection) => (
          <div key={collection.key}>
            <h2>{collection.name}</h2>
            <p>{collection.description}</p>
            <Link
              className="text-button"
              href={`/shop/collections/${collection.key}`}
            >
              View collection →
            </Link>
          </div>
        ))}
      </section>
      <form
        method="get"
        action="/shop"
        className="catalog-filters"
        aria-label="Filter outfits"
      >
        {facets.map(({ key, label, options }) => (
          <label key={key}>
            {label}
            <select name={key} defaultValue={catalog.selected[key]}>
              <option value="">All</option>
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <div className="studio-actions">
          <button type="submit" className="secondary-button">
            Apply filters
          </button>
          <Link href="/shop" className="text-button">
            Clear
          </Link>
        </div>
      </form>
      <p className="muted">{catalog.products.length} demo outfits</p>
      {catalog.products.length ? (
        <ProductGrid products={catalog.products} />
      ) : (
        <p>Try another combination of filters.</p>
      )}
    </main>
  );
}
