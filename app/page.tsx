import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Camera,
  ClipboardList,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { FitPassport } from '@/components/landing/FitPassport';
import { ScanDemo } from '@/components/landing/ScanDemo';
import { agreementPath } from '@/lib/consent/agreements';

const steps = [
  {
    icon: Camera,
    title: 'Position yourself',
    text: 'Set up your camera and follow the guide to frame your whole body.',
  },
  {
    icon: ScanLine,
    title: 'Capture your measurements',
    text: 'Turn naturally when prompted while ContourStitch estimates your body dimensions.',
  },
  {
    icon: ClipboardList,
    title: 'Discover your fit',
    text: 'Review, correct and save your personal measurements so you can use them again.',
  },
];

const uses = [
  {
    title: 'Personalized tailoring',
    text: 'Bring a reviewed set of measurements to a tailor for your next custom garment.',
  },
  {
    title: 'Family fittings',
    text: 'Invite relatives in different cities to one private group. Each person can measure remotely and choose what to share.',
    href: '/family-fit',
    label: 'Open Family Fit Studio',
  },
  {
    title: 'Online clothing shopping',
    text: 'Keep your measurements handy when comparing size guides from different brands.',
  },
  {
    title: 'Reusable personal fit profiles',
    text: 'Update your saved measurements as your fit changes and bring them to your next fitting.',
  },
];

const privacy = [
  {
    icon: Camera,
    title: 'On-device processing',
    text: 'Camera frames, pose landmarks and silhouettes are processed in your browser.',
  },
  {
    icon: LockKeyhole,
    title: 'Save by choice',
    text: 'Save derived measurements on this device or to your account. A scan alone creates no saved profile.',
  },
  {
    icon: UserRound,
    title: 'You control access',
    text: 'Review consent and delete saved data in My Account. Manage measurement sharing in Family Fit Studio.',
  },
];

export default function Home() {
  return (
    <main id="main" className="landing">
      <section
        className="landing-hero landing-shell"
        aria-labelledby="landing-title"
      >
        <div className="landing-hero-copy">
          <h1 id="landing-title">
            <span>One measure.</span> <em>Endless fits.</em>
          </h1>
          <p className="landing-lede">
            Transform your camera into a personal measurement tool. Measure
            once, discover your fit, and reuse your measurements wherever you
            go.
          </p>
          <div className="landing-actions">
            <Link href="/measure" className="landing-button">
              Find My Fit <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="landing-inline">
              See How It Works <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="landing-hero-privacy">
            <LockKeyhole size={15} aria-hidden="true" /> Camera processing stays
            on your device.
          </p>
        </div>

        <figure className="landing-hero-art">
          <div className="hero-art-header">
            <ScanLine size={17} aria-hidden="true" /> Guided measurement
          </div>
          <Image
            src="/editorial/measurement-atelier.jpg"
            alt="A tailor measuring a wireframe mannequin with a tape measure"
            fill
            sizes="(max-width: 699px) 91vw, (max-width: 1100px) 45vw, 600px"
            loading="eager"
            fetchPriority="high"
            className="landing-hero-image"
          />
        </figure>
      </section>

      <section
        className="landing-process"
        id="how-it-works"
        aria-labelledby="landing-process-title"
      >
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="landing-kicker">How it works</p>
            <h2 id="landing-process-title">From camera to fit.</h2>
          </div>
          <ol className="landing-steps">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="landing-reveal">
                <div className="landing-step-marker">
                  <Icon size={25} strokeWidth={1.55} aria-hidden="true" />
                  <span aria-hidden="true">0{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="landing-technology"
        id="measurement-preview"
        aria-labelledby="landing-technology-title"
      >
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="landing-kicker">Measurement technology</p>
            <h2 id="landing-technology-title">See how a scan takes shape.</h2>
            <p>
              Explore how landmarks and body contours help estimate measurements
              from guided video.
            </p>
          </div>
          <ScanDemo />
        </div>
      </section>

      <section
        className="landing-uses landing-shell"
        aria-labelledby="landing-uses-title"
      >
        <div className="landing-section-heading">
          <h2 id="landing-uses-title">A better fit for real life.</h2>
        </div>
        <div className="landing-uses-grid">
          <ul className="landing-use-list">
            {uses.map(({ title, text, href, label }) => (
              <li key={title} className="landing-reveal">
                <h3>{title}</h3>
                <p>{text}</p>
                {href && (
                  <Link href={href} prefetch={false} className="landing-inline">
                    {label} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="landing-passport"
        aria-labelledby="landing-passport-title"
      >
        <div className="landing-shell landing-passport-grid">
          <div className="landing-section-heading">
            <p className="landing-kicker">Your measurements, ready to reuse</p>
            <h2 id="landing-passport-title">Digital Fit Passport.</h2>
            <p>
              Save a private fit profile, edit measurements when they change,
              and review earlier versions in your account. Save on this device
              for quick access or sign in to open your profile across devices.
            </p>
            <Link
              href="/my-measurements"
              prefetch={false}
              className="landing-button"
            >
              Open My Fit Profile <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <FitPassport />
        </div>
      </section>

      <section className="landing-trust" aria-labelledby="landing-trust-title">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="landing-kicker">
              <ShieldCheck size={17} aria-hidden="true" /> Privacy &amp; trust
            </p>
            <h2 id="landing-trust-title">Your body. Your data. Your choice.</h2>
          </div>
          <ul className="landing-privacy-grid">
            {privacy.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={22} strokeWidth={1.55} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
          <div className="landing-actions">
            <Link href={agreementPath('PRIVACY')} className="landing-inline">
              Read the Privacy Policy{' '}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/results" className="landing-inline">
              Enter tape measurements{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
