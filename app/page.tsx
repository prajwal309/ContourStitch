import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  Save,
  ScanLine,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { collections, products } from '@/lib/shop/catalog';
import { ProductGrid } from '@/components/shop/ProductGrid';

const steps = [
  {
    icon: Camera,
    title: 'Measure once',
    text: 'Take two guided photos or enter tape measurements. Review and adjust each result.',
  },
  {
    icon: Save,
    title: 'Save your fit',
    text: 'Save a private fit profile to your account. Update it whenever your measurements change.',
  },
  {
    icon: ScanLine,
    title: 'Shop with confidence',
    text: 'Reuse your measurements across outfits. Add any extra dimensions a garment needs.',
  },
  {
    icon: Users,
    title: 'Dress together',
    text: 'Invite family to a shared collection and coordinate outfits for your occasion.',
  },
];

export default function Home() {
  const wedding = collections[0];

  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Personal fit for weddings and beyond</p>
          <h1>
            Measure Once.<em>Wear Everywhere.</em>
          </h1>
          <p className="hero-description">
            Create a personal fit profile you can reuse for weddings,
            celebrations, and future collections.
          </p>
          <div className="studio-actions">
            <Link href="/measure" className="button">
              Create My Fit Profile <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/shop" className="secondary-button">
              Explore Collections
            </Link>
          </div>
          <p className="micro">
            Already measured?{' '}
            <Link
              className="inline-link"
              href="/my-measurements"
              prefetch={false}
            >
              Open My Fit Profile
            </Link>
          </p>
          <div className="hero-trust">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Your photos stay on your device.</span>
          </div>
        </div>

        <figure className="hero-art">
          <div className="hero-image">
            <Image
              src="/editorial/heritage-atelier.webp"
              alt="Herringbone jacket on a tailor’s dress form with a measuring tape"
              fill
              sizes="(max-width: 640px) 95vw, (max-width: 1280px) 44vw, 570px"
              preload
            />
          </div>
          <figcaption>
            Start with two guided photos and a tape check.
          </figcaption>
        </figure>
      </section>

      <section
        className="process-section"
        id="how-it-works"
        aria-labelledby="process"
      >
        <div className="section-heading">
          <h2 id="process">From first measure to family fitting.</h2>
        </div>
        <div className="steps-grid journey-grid">
          {steps.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon size={23} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="process-section"
        aria-labelledby="featured-collection"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Family wedding wear · Demo collection</p>
            <h2 id="featured-collection">{wedding.name}</h2>
          </div>
          <Link
            href={`/shop/collections/${wedding.key}`}
            className="text-button"
          >
            View the collection <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <ProductGrid
          products={products.filter(
            ({ collectionKey }) => collectionKey === wedding.key,
          )}
        />
      </section>

      <section className="honesty">
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <h2>Check your measurements with a tape.</h2>
          <p>
            Review estimates before garment production and update your fit
            profile as your body or garment requirements change.
          </p>
        </div>
        <Link className="text-button" href="/results">
          Use a measuring tape <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
