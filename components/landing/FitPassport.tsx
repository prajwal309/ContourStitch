import { Fingerprint, LockKeyhole } from 'lucide-react';
import { PassportMannequin } from './PassportMannequin';
import { demoMeasurements } from './demo-data';

const passportMeasurements = [
  demoMeasurements[1],
  demoMeasurements[2],
  demoMeasurements[3],
] as const;

const regions = ['chest', 'waist', 'hip'] as const;

function MeasurementIcon({ region }: { region: (typeof regions)[number] }) {
  const ringPath = {
    chest: 'M4 8c3 2 9 2 12 0',
    waist: 'M5 12c2 1.5 8 1.5 10 0',
    hip: 'M4 16c3 2 9 2 12 0',
  }[region];

  return (
    <svg
      className="passport-measurement-icon"
      viewBox="0 0 20 22"
      aria-hidden="true"
    >
      <path d="M7 2c-2 .5-3 2-3 4v3l1 3-.8 4 2 3h7.6l2-3-.8-4 1-3V6c0-2-1-3.5-3-4" />
      <path d={ringPath} />
    </svg>
  );
}

function ContourDecoration() {
  return (
    <svg
      className="passport-contours"
      viewBox="0 0 180 120"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 120C18 70 70 14 180 4" />
      <path d="M31 120C43 76 91 28 180 20" />
      <path d="M54 120c12-38 52-78 126-91" />
      <path d="M78 120c11-30 43-59 102-77" />
      <path d="M104 120c9-21 31-41 76-61" />
    </svg>
  );
}

export function FitPassport() {
  return (
    <figure className="passport-visual">
      <div className="passport-card">
        <ContourDecoration />
        <div className="passport-top">
          <span className="passport-fingerprint">
            <Fingerprint size={22} strokeWidth={1.35} aria-hidden="true" />
          </span>
          <span className="passport-example">Example profile</span>
        </div>
        <h3 className="passport-title">Digital Fit Passport</h3>
        <p className="passport-owner">
          <LockKeyhole size={14} strokeWidth={1.7} aria-hidden="true" />
          Private profile
        </p>
        <div className="passport-divider" aria-hidden="true" />
        <div className="passport-details">
          <PassportMannequin />
          <dl className="passport-readings">
            {passportMeasurements.map(({ label, value }, index) => (
              <div key={label}>
                <dt>
                  <MeasurementIcon region={regions[index]} />
                  <span>{label}</span>
                </dt>
                <dd>
                  <span className="passport-reading-value">{value}</span>
                  <span className="passport-reading-unit">cm</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption className="sr-only">
        Illustrative Digital Fit Passport with sample chest circumference of 90
        centimetres, waist circumference of 73 centimetres, and hip
        circumference of 97 centimetres.
      </figcaption>
    </figure>
  );
}
