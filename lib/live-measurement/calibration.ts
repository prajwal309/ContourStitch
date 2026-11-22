import { validHeight } from '@/lib/measurement/units';
import { liveConfig } from './config';

export type Calibration = { kind: 'height' | 'reference'; heightCm: number };

/** A vertical segment in the same frontal plane as a standing subject estimates stature for later views. */
export function calibrateReference(
  heightCm: number,
  lengthCm: number,
  bodyPixels: number,
  referencePixels: number,
): Calibration | null {
  if (
    !validHeight(heightCm) ||
    !Number.isFinite(lengthCm) ||
    lengthCm <= 0 ||
    !Number.isFinite(bodyPixels) ||
    bodyPixels <= 1 ||
    !Number.isFinite(referencePixels) ||
    referencePixels < liveConfig.minReferencePixels
  )
    return null;

  const estimatedHeight = (lengthCm * bodyPixels) / referencePixels;
  if (
    !validHeight(estimatedHeight) ||
    Math.abs(estimatedHeight - heightCm) / heightCm >
      liveConfig.crossViewTolerance
  )
    return null;
  return { kind: 'reference', heightCm: estimatedHeight };
}
