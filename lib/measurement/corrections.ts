import type {
  MeasurementEstimate,
  MeasurementKey,
  MeasurementReport,
} from './types';

export const tapeMethod = 'Manually entered tape measurement';

export function tapeEstimate(
  key: MeasurementKey,
  valueCm: number,
): MeasurementEstimate {
  return {
    key,
    valueCm,
    uncertaintyCm: 2,
    confidence: 'low',
    method: tapeMethod,
    warnings: [
      'Tape entry accuracy is not assessed. The ±2 cm range is a working allowance, not a validated interval. Confirm your tape placement before garment production.',
    ],
  };
}

export function correctMeasurement(
  report: MeasurementReport,
  key: MeasurementKey,
  valueCm: number,
): MeasurementReport {
  const previous = report.estimates.find((estimate) => estimate.key === key);
  const originalEstimates = [...(report.originalEstimates ?? [])];
  if (previous && previous.method !== tapeMethod)
    originalEstimates.push(previous);

  const missing = { ...report.missing };
  delete missing[key];

  return {
    estimates: [
      ...report.estimates.filter((estimate) => estimate.key !== key),
      tapeEstimate(key, valueCm),
    ],
    missing,
    ...(originalEstimates.length && { originalEstimates }),
  };
}
