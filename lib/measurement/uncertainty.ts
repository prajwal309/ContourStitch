import type { Quality } from '@/lib/vision/types';
import type { MeasurementEstimate, MeasurementKey } from './types';
import { config } from './config';
export function uncertainty(
  key: MeasurementKey,
  qualities: Quality[],
  scaleDifference = 0,
): Pick<MeasurementEstimate, 'confidence' | 'warnings'> & {
  uncertaintyCm: null;
} {
  const warnings: string[] = [];
  let penalty = scaleDifference * config.scalePenalty;
  for (const q of qualities) {
    const failed = q.checks.filter((c) => !c.passed);
    penalty +=
      failed.length * config.qualityPenalty +
      (1 - q.landmarkConfidence) +
      q.segmentationInstability * config.instabilityPenalty;
    if (q.override) {
      penalty += config.overridePenalty;
      warnings.push('Capture quality checks were overridden.');
    }
    if (failed.length) warnings.push(...failed.map((c) => c.label));
  }
  if (scaleDifference > config.maxScaleDifference)
    warnings.push(
      'The image scales differ between views; perspective or stance may have changed.',
    );
  if (key === 'inseam')
    warnings.push(
      'The crotch location is only weakly constrained from photographs.',
    );
  warnings.push(
    'Unvalidated estimate: confirm this measurement with a tape before garment production.',
  );
  warnings.push(
    'Model confidence describes capture quality, not a calibrated physical uncertainty range.',
  );
  return {
    uncertaintyCm: null,
    confidence: key === 'inseam' || penalty > 0.5 ? 'low' : 'medium',
    warnings: [...new Set(warnings)],
  };
}
