import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  Ruler,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

const steps = [
  {
    icon: Camera,
    title: 'Find your angle',
    text: 'Enter your height, then take a front and side photo with our on-screen guide.',
  },
  {
    icon: ScanLine,
    title: 'See the estimate',
    text: 'Get eight body measurements with clear ranges and confidence indicators.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Make it yours',
    text: 'Check with a tape, adjust any measurement, and save a profile on this device.',
  },
];

export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A more personal approach to fit</p>
          <h1>
            Your shape.
            <br />
            Your measurements.
            <em>A better starting point.</em>
          </h1>
          <p className="hero-description">
            Two guided photos give you a set of estimated body measurements you
            can review, refine with a tape, and make your own.
          </p>
          <Link href="/measure" className="button">
            Start measurement <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className="micro">About 3 minutes · No account needed</p>
          <div className="hero-trust">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Your photos stay on your device. Always.</span>
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
            <span>Front and side photos build your fit profile.</span>
            <Ruler size={18} aria-hidden="true" />
          </figcaption>
        </figure>
      </section>

      <section
        className="process-section"
        id="how-it-works"
        aria-labelledby="process"
      >
        <div className="section-heading">
          <h2 id="process">A few steps closer to your fit.</h2>
          <p>
            No measuring expertise required. We’ll guide you from start to
            finish.
          </p>
        </div>

        <div className="steps-grid">
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
            These photo-based body estimates are a starting point for fit.
            Always confirm them before cutting or ordering made-to-measure
            clothing.
          </p>
        </div>
        <Link className="text-button" href="/results">
          Use a measuring tape <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
