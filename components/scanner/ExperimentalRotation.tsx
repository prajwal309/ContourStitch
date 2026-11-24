'use client';
import { useState } from 'react';
import Link from 'next/link';
import { HeightForm } from '@/components/measurement/HeightForm';
import { VideoMeasurementScanner } from '@/components/scanner/VideoMeasurementScanner';
import type { MeasurementEngineId } from '@/lib/reconstruction/types';

const silhouetteViewCounts = [4, 8, 16, 32, 64] as const;

function isSilhouetteViewCount(
  value: number,
): value is (typeof silhouetteViewCounts)[number] {
  return silhouetteViewCounts.some((count) => count === value);
}

export default function ExperimentalRotation() {
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<'intro' | 'height' | 'scan'>('intro');
  const [height, setHeight] = useState(170);
  const [engine, setEngine] = useState<MeasurementEngineId>('baseline');
  const [viewCount, setViewCount] = useState<4 | 8 | 16 | 32 | 64>(16);
  return (
    <main id="main" className="flow">
      <section className="flow-card">
        <p className="eyebrow">RESEARCH PREVIEW · PRIVATE BY DESIGN</p>
        <h1>Compare measurement engines</h1>
        {step === 'intro' ? (
          <>
            <p>
              Use one guided full-body turn to compare the current baseline
              against an independent visual-hull reconstruction. Camera frames
              and masks stay in browser memory and are discarded when you leave.
            </p>
            <fieldset className="engine-options">
              <legend>Choose a measurement engine</legend>
              <label>
                <input
                  type="radio"
                  name="measurement-engine"
                  checked={engine === 'baseline'}
                  onChange={() => setEngine('baseline')}
                />
                <span>
                  <strong>Existing Measurement Algorithm</strong>
                  <small>Four-view normalized silhouette geometry.</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="measurement-engine"
                  checked={engine === 'parametric'}
                  onChange={() => setEngine('parametric')}
                />
                <span>
                  <strong>Parametric 3D Body Fitting — Beta</strong>
                  <small>
                    Not runnable: requires an external PyTorch service and a
                    commercially licensed body model.
                  </small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="measurement-engine"
                  checked={engine === 'visual-hull'}
                  onChange={() => setEngine('visual-hull')}
                />
                <span>
                  <strong>Multi-View Silhouette Reconstruction — Beta</strong>
                  <small>
                    Browser-side voxel carving from binary turn silhouettes;
                    uncertainty is not calibrated.
                  </small>
                </span>
              </label>
            </fieldset>
            {engine === 'visual-hull' && (
              <label className="view-count">
                Silhouette views
                <select
                  value={viewCount}
                  onChange={(event) => {
                    const count = Number(event.target.value);
                    if (isSilhouetteViewCount(count)) setViewCount(count);
                  }}
                >
                  {silhouetteViewCounts.map((count) => (
                    <option key={count} value={count}>
                      {count} angles
                    </option>
                  ))}
                </select>
              </label>
            )}
            <ul className="privacy-list">
              <li>
                Use a laptop RGB webcam, stand far enough back for your full
                body to stay in frame, and leave room to turn.
              </li>
              <li>
                Wear fitted clothing, stand barefoot, and keep your head and
                both feet visible.
              </li>
              <li>
                Ask a helper to keep the camera level around waist height.
              </li>
              <li>
                Enter your height as the metric scale anchor. Uncalibrated RGB
                images alone cannot determine absolute body dimensions.
              </li>
              <li>
                No photographs are uploaded or saved. Low-resolution binary
                silhouettes are used only during this in-memory scan.
              </li>
              <li>
                These are research estimates, not validated tailoring
                measurements. Confirm them with a tape.
              </li>
            </ul>
            <p>
              <Link href="/measure/benchmarks">
                Open the local validation comparison dashboard
              </Link>
            </p>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{' '}
              I agree to browser-side camera processing.
            </label>
            {engine === 'parametric' && (
              <p role="status" className="muted">
                This option is unavailable until a compatible commercial model
                license and PyTorch inference service are configured. No
                substitute measurements will be generated.
              </p>
            )}
            <button
              className="button"
              disabled={!consent || engine === 'parametric'}
              onClick={() => setStep('height')}
            >
              Continue →
            </button>
            <Link className="text-button" href="/measure">
              Use the guided video session
            </Link>
          </>
        ) : step === 'height' ? (
          <>
            <HeightForm
              continueLabel="Continue to video scan →"
              onContinue={(cm) => {
                setHeight(cm);
                setStep('scan');
              }}
            />
            {engine === 'visual-hull' && (
              <p className="muted">
                The scan will target {viewCount} silhouette angles. Missed or
                low-quality angles are reported, not filled in.
              </p>
            )}
          </>
        ) : (
          <VideoMeasurementScanner
            heightCm={height}
            engine={engine === 'visual-hull' ? 'visual-hull' : 'baseline'}
            silhouetteViewCount={viewCount}
            onClose={() => setStep('intro')}
          />
        )}
      </section>
    </main>
  );
}
