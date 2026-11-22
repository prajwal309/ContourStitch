import { createHash } from 'node:crypto';
import { tapeEstimate, tapeMethod } from '@/lib/measurement/corrections';
import {
  measurementKeys,
  type MeasurementEstimate,
  type MeasurementKey,
  type Unit,
} from '@/lib/measurement/types';
import { sanitizeProfile } from '@/lib/storage/profile';

export function prepareProfile(input: unknown) {
  const profile = sanitizeProfile(input);
  if (!profile || !profile.report.estimates.length) return null;

  const { report, unit } = profile;
  const estimates: MeasurementEstimate[] = [];
  const corrections: Partial<Record<MeasurementKey, number>> = {};
  const values: Partial<Record<MeasurementKey, number>> = {};

  for (const key of measurementKeys) {
    const current = report.estimates.find((estimate) => estimate.key === key);
    if (!current) continue;
    values[key] = current.valueCm;

    if (current.method === tapeMethod) {
      corrections[key] = current.valueCm;
      const original = report.originalEstimates?.find(
        (estimate) => estimate.key === key,
      );
      if (original) estimates.push(original);
    } else {
      estimates.push(current);
    }
  }

  if (estimates.some((estimate) => estimate.warnings.length > 24)) return null;

  // Identical measurement values in a different display unit still describe the same profile.
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(values))
    .digest('hex');
  return { estimates, corrections, missing: report.missing, unit, fingerprint };
}

export function restoreProfile({
  unit,
  estimates,
  corrections,
  missing,
}: {
  unit: Unit;
  estimates: unknown;
  corrections: unknown;
  missing: unknown;
}) {
  const original = sanitizeProfile({
    version: 1,
    unit,
    report: { estimates, missing },
  });
  if (!original || !corrections || typeof corrections !== 'object') return null;

  const originals = new Map(
    original.report.estimates.map((estimate) => [estimate.key, estimate]),
  );
  const current: MeasurementEstimate[] = [];
  const originalEstimates: MeasurementEstimate[] = [];
  for (const key of measurementKeys) {
    const estimate = originals.get(key);
    const correction = (
      corrections as Partial<Record<MeasurementKey, unknown>>
    )[key];
    if (typeof correction === 'number') {
      current.push(tapeEstimate(key, correction));
      if (estimate) originalEstimates.push(estimate);
    } else if (estimate) {
      current.push(estimate);
    }
  }
  return sanitizeProfile({
    version: 1,
    unit,
    report: {
      estimates: current,
      originalEstimates,
      missing: original.report.missing,
    },
  });
}
