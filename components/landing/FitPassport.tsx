import { Fingerprint, LockKeyhole } from 'lucide-react';
import { demoMeasurements } from './demo-data';

export function FitPassport() {
  return (
    <figure className="passport-visual">
      <div className="passport-card">
        <div className="passport-top">
          <Fingerprint size={26} strokeWidth={1.45} aria-hidden="true" />
          <span>Example profile</span>
        </div>
        <p className="passport-title">Digital Fit Passport</p>
        <p className="passport-owner">
          <LockKeyhole size={14} aria-hidden="true" /> Private fit profile
        </p>
        <dl className="passport-readings">
          {demoMeasurements.slice(1, 4).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {value} <span>cm</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <figcaption className="sr-only">
        Illustrative Digital Fit Passport with sample chest, waist and hip
        measurements.
      </figcaption>
    </figure>
  );
}
