import { liveConfig } from './config';

export type CameraPrecision = {
  uncertaintyCm: number;
  stable: boolean;
};

export function precisionProgress(precision?: CameraPrecision) {
  if (!precision) return null;
  const { targetCm } = liveConfig.precision;
  const ratio = targetCm / Math.max(targetCm, precision.uncertaintyCm);
  const acquired = precision.stable && precision.uncertaintyCm <= targetCm;
  return {
    acquired,
    fraction: acquired ? 1 : Math.min(0.99, ratio),
    // Only the transition duration changes. The target always comes from evidence.
    durationMs: acquired ? 0 : Math.round(160 + 520 * ratio ** 2),
  };
}

export function formatPrecision(cm: number) {
  // Round outward so the label cannot display the target before the estimate reaches it.
  return (Math.ceil((cm - Number.EPSILON) * 10) / 10).toFixed(1);
}
