'use client';
import { useState } from 'react';
import Link from 'next/link';
import { HeightForm } from '@/components/measurement/HeightForm';
import { VideoMeasurementScanner } from '@/components/scanner/VideoMeasurementScanner';
export default function VideoMeasure() {
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<'intro' | 'height' | 'scan'>('intro');
  const [height, setHeight] = useState(170);
  return (
    <main id="main" className="flow">
      <section className="flow-card">
        <p className="eyebrow">EXPERIMENTAL · PRIVATE BY DESIGN</p>
        <h1>Video body measurement</h1>
        {step === 'intro' ? (
          <>
            <p>A guided full-body turn, processed entirely in your browser.</p>
            <ul className="privacy-list">
              <li>
                Use a phone or computer camera and leave enough room to turn
                around.
              </li>
              <li>
                Wear fitted clothing, stand barefoot, and keep your head and
                both feet visible.
              </li>
              <li>
                Ask a helper to keep the camera level around waist height.
              </li>
              <li>
                Enter your height to provide scale. Guidance will help you find
                your position.
              </li>
              <li>
                Video stays in memory and is never uploaded or saved. Only
                numerical features are kept during this scan.
              </li>
              <li>
                This is an engineering prototype, without validated measurement
                accuracy.
              </li>
            </ul>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{' '}
              I agree to browser-side camera processing.
            </label>
            <button
              className="button"
              disabled={!consent}
              onClick={() => setStep('height')}
            >
              Start measurement →
            </button>
            <Link className="text-button" href="/measure">
              Use guided photographs or tape measurements
            </Link>
          </>
        ) : step === 'height' ? (
          <HeightForm
            continueLabel="Continue to video scan →"
            onContinue={(cm) => {
              setHeight(cm);
              setStep('scan');
            }}
          />
        ) : (
          <VideoMeasurementScanner
            heightCm={height}
            onClose={() => setStep('intro')}
          />
        )}
      </section>
    </main>
  );
}
