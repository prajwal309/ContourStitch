'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { HeightForm } from '@/components/measurement/HeightForm';
import { LiveMeasurementCamera } from '@/components/live-measurement/LiveMeasurementCamera';
import { useSession } from '@/components/SessionProvider';
import {
  MeasurementConsentForm,
  useCameraAccessCheck,
  type MeasurementAccess,
} from '@/components/consent/MeasurementConsentForm';
import type { MeasurementReport } from '@/lib/measurement/types';

export function GuidedMeasurement({ access }: { access: MeasurementAccess }) {
  const [step, setStep] = useState<'consent' | 'calibration' | 'scan'>(
    'consent',
  );
  const verifyCameraAccess = useCameraAccessCheck(access.userId);
  const [reference, setReference] = useState(false);
  const [height, setHeight] = useState(170);
  const { setReport } = useSession();
  const router = useRouter();

  function review(report: MeasurementReport) {
    setReport(report);
    router.push('/results');
  }

  const tapeEntry = () =>
    review({ source: 'live-video', estimates: [], missing: {} });

  return (
    <main id="main" className={`flow${step === 'scan' ? ' live-flow' : ''}`}>
      <section className="flow-card">
        <p className="eyebrow">One measure. Endless fits.</p>
        <h1>
          {step === 'consent'
            ? 'Guided video measurements'
            : step === 'calibration'
              ? 'Set your scale'
              : 'Follow the poses'}
        </h1>
        {step === 'consent' && (
          <>
            <LockKeyhole className="privacy-icon" aria-hidden="true" />
            <p>Your body. Your data. Your choice.</p>
            <p>
              Use five guided poses to estimate seven body measurements as
              evidence becomes available. You can review and correct them before
              saving a fit profile.
            </p>
            <ul className="privacy-list">
              <li>
                Wear fitted clothing, stand barefoot, and leave room to extend
                your arms and turn.
              </li>
              <li>
                Keep the camera level with your entire body in view. Ask anyone
                nearby to step out of frame.
              </li>
              <li>
                Camera frames are processed in this browser. Video is never
                recorded or uploaded. Only measurements you choose to save are
                retained.
              </li>
              <li>
                Video estimates are experimental. Confirm measurements with a
                tape before garment production.
              </li>
            </ul>
            <MeasurementConsentForm
              access={access}
              onContinue={() => setStep('calibration')}
              label="Continue privately →"
            />
            <button type="button" className="text-button" onClick={tapeEntry}>
              Enter tape measurements instead
            </button>
            <Link className="text-button" href="/measure/experimental">
              Compare experimental measurement engines
            </Link>
          </>
        )}
        {step === 'calibration' && (
          <>
            <p>
              Enter your height to set an approximate scale. Keep the camera
              position fixed throughout the scan.
            </p>
            <label className="consent">
              <input
                type="checkbox"
                checked={reference}
                onChange={(event) => setReference(event.target.checked)}
              />
              Add a known-size reference object (optional)
            </label>
            <HeightForm
              continueLabel="Start guided video →"
              onContinue={(cm) => {
                setHeight(cm);
                setStep('scan');
              }}
            />
            <button type="button" className="text-button" onClick={tapeEntry}>
              Enter tape measurements instead
            </button>
          </>
        )}
        {step === 'scan' && (
          <LiveMeasurementCamera
            heightCm={height}
            useReference={reference}
            verifyCameraAccess={verifyCameraAccess}
            onReview={review}
          />
        )}
      </section>
    </main>
  );
}
