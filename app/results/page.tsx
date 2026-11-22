'use client';

import Link from 'next/link';
import { useSession } from '@/components/SessionProvider';
import { MeasurementResult } from '@/components/measurement/MeasurementResult';

export default function Results() {
  const { report, setReport, unit, setUnit } = useSession();

  return (
    <main id="main" className="flow results-flow">
      <section className="flow-card">
        <p className="eyebrow">YOUR PERSONAL FIT PROFILE</p>
        <h1>
          Your measurements.
          <br />
          <em>Your starting point.</em>
        </h1>
        {!report && (
          <p>
            No current photo estimates. Enter tape measurements below, load a
            saved profile, or{' '}
            <Link href="/measure" className="inline-link">
              start a guided capture
            </Link>
            .
          </p>
        )}
        <MeasurementResult
          report={report ?? { estimates: [], missing: {} }}
          onChange={setReport}
          initialUnit={unit}
          onUnitChange={setUnit}
        />
        {!!report?.estimates.length && (
          <div className="account-callout">
            <Link
              href="/my-measurements"
              className="inline-link"
              prefetch={false}
            >
              Save to your account
            </Link>
            <p className="muted">
              Signing in for the first time? Save on this device first, then
              import the saved copy from My Measurements.
            </p>
          </div>
        )}
        <Link href="/measure" className="text-button">
          Start a new measurement →
        </Link>
      </section>
    </main>
  );
}
