import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/shop/catalog';

export function ProductGrid({
  products,
  groupId,
}: {
  products: readonly Product[];
  groupId?: string;
}) {
  return (
    <ul className="catalog-grid" aria-label="Outfits">
      {products.map((product) => (
        <li key={product.key}>
          <Link
            className="catalog-card"
            href={`/shop/${product.key}${groupId ? `?group=${groupId}` : ''}`}
          >
            <div className="catalog-image">
              <Image
                src={product.image}
                alt={product.imageAlt}
                fill
                sizes="(max-width: 650px) 45vw, (max-width: 900px) 30vw, 280px"
              />
            </div>
            <div className="catalog-card-copy">
              <p className="eyebrow">
                {product.age} · {product.style}
              </p>
              <h3>{product.name}</h3>
              <p>
                {[...new Set(product.variants.map(({ color }) => color))].join(
                  ' / ',
                )}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
