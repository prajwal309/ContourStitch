'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Check } from 'lucide-react';
import { HeightForm } from '@/components/measurement/HeightForm';
import { CameraView } from '@/components/camera/CameraView';
import { useSession } from '@/components/SessionProvider';
import { estimateMeasurements } from '@/lib/measurement/estimate';
import type { Capture } from '@/lib/vision/types';
export default function Measure() {
  const [step, setStep] = useState(0);
  const front = useRef<Capture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      front.current = null;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const [height, setHeight] = useState(170);
  const [consent, setConsent] = useState(false);
  const { setReport } = useSession();
  const router = useRouter();
  const names = [
    'Your privacy',
    'Your height',
    'Front photo',
    'Side photo',
    'Processing',
  ];
  return (
    <main id="main" className="flow">
      <ol className="flow-progress" aria-label={`Step ${step + 1} of 5`}>
        {names.map((name, i) => (
          <li
            key={name}
            aria-current={i === step ? 'step' : undefined}
            className={i < step ? 'complete' : undefined}
          >
            <b aria-hidden="true">{i < step ? <Check size={14} /> : i + 1}</b>
            <span>
              {name}
              {i < step && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        ))}
      </ol>
      <section className="flow-card">
        {step === 0 && (
          <LockKeyhole className="privacy-icon" aria-hidden="true" />
        )}
        <h1>{names[step]}</h1>
        {step === 0 ? (
          <>
            <p>Just you, your camera, and a little guidance.</p>
            <ul className="privacy-list">
              <li>Photos are processed in your browser and never uploaded.</li>
              <li>
                Temporary images are released after measurement or when you
                leave.
              </li>
              <li>
                You choose whether to save measurements on this device or to
                your account.
              </li>
              <li>Estimates need tape validation before garment production.</li>
            </ul>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{' '}
              I understand and agree to browser-side camera processing.
            </label>
            <button
              className="button"
              disabled={!consent}
              onClick={() => setStep(1)}
            >
              Continue privately →
            </button>
            <div className="measurement-alternatives">
              <button
                className="text-button"
                onClick={() => {
                  setReport({ estimates: [], missing: {} });
                  router.push('/results');
                }}
              >
                Enter tape measurements instead
              </button>
              <Link className="text-button" href="/measure/video">
                Try the experimental guided video scan →
              </Link>
            </div>
          </>
        ) : step === 1 ? (
          <HeightForm
            onContinue={(cm) => {
              setHeight(cm);
              setStep(2);
            }}
          />
        ) : step < 4 ? (
          <CameraView
            key={step}
            view={step === 2 ? 'front' : 'side'}
            onManual={() => {
              setReport({ estimates: [], missing: {} });
              router.push('/results');
            }}
            onCapture={(capture) => {
              if (step === 2) {
                front.current = capture;
                setStep(3);
              } else {
                setStep(4);
                timer.current = setTimeout(() => {
                  if (front.current) {
                    setReport(
                      estimateMeasurements(height, front.current, capture),
                    );
                    front.current = null;
                  }
                  router.push('/results');
                }, 100);
              }
            }}
          />
        ) : (
          <p role="status">Finding your proportions…</p>
        )}
      </section>
    </main>
  );
}
