import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  SlidersHorizontal,
  ShieldCheck,
  ScanLine,
  Check,
  MoveUpRight,
} from 'lucide-react';

import { BodyGuide } from '@/components/camera/BodyGuide';

export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="dot" /> A MORE PERSONAL APPROACH TO FIT
          </p>

          <h1>
            Your shape.
            <br />
            Your measurements.
            <br />
            <em>A better starting point.</em>
          </h1>

          <p className="hero-description">
            Two guided photos. A little perspective.
            <br />
            Get estimated body measurements you can review, refine, and make
            your own.
          </p>

          <Link href="/measure" className="button">
            Start measurement
            <ArrowRight size={18} />
          </Link>

          <p className="micro">
            About 3 minutes <span>·</span> No account needed
          </p>

          <div className="hero-trust">
            <ShieldCheck size={19} />
            <span>Your photos stay on your device. Always.</span>
          </div>
        </div>

        <div className="hero-art">
          <div className="art-top">
            <span>
              <span className="dot" /> YOUR PERSONAL FIT PROFILE
            </span>

            <ScanLine size={20} />
          </div>

          <div className="figure-stage">
            <div className="orbit" />

            <BodyGuide />

            <div className="measure-tag tag-shoulder">
              <span>Shoulder breadth</span>
              <strong>Your proportions, understood</strong>
            </div>

            <div className="measure-tag tag-waist">
              <span>Waist circumference</span>

              <strong>
                A considered estimate
                <Check size={14} />
              </strong>
            </div>

            <div className="ruler" aria-hidden="true">
              —
              <br />
              –
              <br />
              –
              <br />
              —
              <br />
              –
              <br />
              –
              <br />
              —
              <br />
              –
              <br />
              –
              <br />
              —
              <br />
              –
              <br />
              –
              <br />—
            </div>

            <span className="art-caption">
              A little guidance. A clearer picture.
            </span>
          </div>

          <div className="art-bottom">
            <span>01 / FRONT VIEW</span>

            <span>
              02 / SIDE VIEW
              <MoveUpRight size={14} />
            </span>
          </div>
        </div>
      </section>

      <section className="process-section" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SIMPLE BY DESIGN</p>
            <h2>A few steps closer to your fit.</h2>
          </div>

          <p>
            No measuring expertise required.
            <br />
            We’ll guide you from start to finish.
          </p>
        </div>

        <div className="steps-grid">
          {[
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
          ].map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <div className="step-top">
                <Icon size={23} />
                <span>0{i + 1}</span>
              </div>

              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="honesty">
        <ShieldCheck size={28} />

        <div>
          <h3>A starting point, not a promise of perfect fit.</h3>

          <p>
            Photos can only tell us so much. These are body measurement
            estimates, not garment patterns. Always confirm with a tape before
            cutting or ordering made-to-measure clothing.
          </p>
        </div>

        <Link href="/results">
          Use a measuring tape
          <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}