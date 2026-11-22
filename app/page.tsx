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
import { brand } from '@/lib/brand';

const steps = [
  {
    icon: Camera,
    title: 'Find your fit',
    text: 'Follow a guided video scan or enter tape measurements. Review and adjust each result.',
  },
  {
    icon: Save,
    title: 'Save your fit',
    text: 'Save a private fit profile to your account. Update it whenever your measurements change.',
  },
  {
    icon: ScanLine,
    title: 'Reuse your measurements',
    text: 'Bring your saved measurements to your next fitting or use them to compare size guides.',
  },
  {
    icon: Users,
    title: 'Plan a family fitting',
    text: 'Invite family to a private group for your next occasion.',
  },
];

export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            {brand.name} <em>{brand.tagline}</em>
          </h1>
          <p className="hero-description">{brand.description}</p>
          <div className="studio-actions">
            <Link href="/measure" className="button">
              Create My Fit Profile <ArrowRight size={18} aria-hidden="true" />
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
            <span>Your camera video stays on your device.</span>
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
          <figcaption>Start with guided video and a tape check.</figcaption>
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
