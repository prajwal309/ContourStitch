import type { VisionFrame } from '@/lib/vision/types';
import { maskBounds } from '@/lib/vision/segmentation';
import { landmarkPath, samplingLevels } from '@/lib/measurement/landmarks';
import { median, robustWidth } from '@/lib/measurement/silhouette';
import { ellipseCircumference } from '@/lib/measurement/circumference';
import type {
  BodyScanFeatures,
  Candidate,
  FrameFeatures,
  ScanView,
  ScanResult,
} from './types';
export function extractFeatures(frame: VisionFrame): FrameFeatures {
  const mask = frame.mask,
    bounds = maskBounds(mask),
    levels = samplingLevels(frame);
  // Pose-only capture is supported, but scale and silhouette measurements require a mask.
  const bodyPixels =
    mask && bounds ? (bounds.height * frame.height) / mask.height : null;
  const path = (indices: number[]) => {
    const length = landmarkPath(
      indices.map((i) => frame.landmarks[i]),
      frame.width,
      frame.height,
    );
    return length && bodyPixels ? length / bodyPixels : null;
  };
  const width = (key: 'chest' | 'waist' | 'hip') => {
    const value =
      mask && levels
        ? robustWidth(
            mask,
            levels[key] * mask.height,
            levels.centerX * mask.width,
          )
        : null;
    return value && bodyPixels && mask
      ? (value * frame.width) / mask.width / bodyPixels
      : null;
  };
  return {
    shoulder: path([11, 12]),
    chest: width('chest'),
    waist: width('waist'),
    hip: width('hip'),
    torso: median(
      [path([11, 23]), path([12, 24])].filter((v): v is number => v !== null),
    ),
    leg: median(
      [path([23, 25, 27]), path([24, 26, 28])].filter(
        (v): v is number => v !== null,
      ),
    ),
    arm: median(
      [path([11, 13, 15]), path([12, 14, 16])].filter(
        (v): v is number => v !== null,
      ),
    ),
  };
}
export function aggregate(
  heightCm: number,
  views: Record<ScanView, Candidate[]>,
  warnings: string[],
): ScanResult {
  const value = (view: ScanView, key: keyof FrameFeatures) =>
    median(
      views[view]
        .map((v) => v.features[key])
        .filter((v): v is number => v !== null),
    );
  const sides = (key: keyof FrameFeatures) =>
    median(
      ['LEFT_SIDE', 'RIGHT_SIDE']
        .flatMap((view) => views[view as ScanView].map((v) => v.features[key]))
        .filter((v): v is number => v !== null),
    );
  const score = (view: ScanView) =>
    median(views[view].map((v) => v.quality)) ?? 0;
  const overall = Math.min(
    ...Object.values(views).map(
      (samples) => median(samples.map((v) => v.quality)) ?? 0,
    ),
  );
  const features: BodyScanFeatures = {
    heightCm,
    shoulderWidthRatio: value('FRONT', 'shoulder'),
    chestFrontRatio: value('FRONT', 'chest'),
    chestSideRatio: sides('chest'),
    waistFrontRatio: value('FRONT', 'waist'),
    waistSideRatio: sides('waist'),
    hipFrontRatio: value('FRONT', 'hip'),
    hipSideRatio: sides('hip'),
    torsoLengthRatio: value('FRONT', 'torso'),
    legLengthRatio: value('FRONT', 'leg'),
    armLengthRatio: value('FRONT', 'arm'),
    scanQuality: overall,
  };
  return {
    features,
    quality: {
      overall,
      frontQuality: score('FRONT'),
      leftQuality: score('LEFT_SIDE'),
      backQuality: score('BACK'),
      rightQuality: score('RIGHT_SIDE'),
      warnings: [
        ...new Set([
          ...warnings,
          'Loose clothing, camera tilt and inferred orientation can distort these estimates.',
          ...(Object.values(features).some((v) => v === null)
            ? [
                'Some silhouette features were unavailable. Missing measurements are not inferred.',
              ]
            : []),
        ]),
      ],
    },
  };
}
export function geometryBaseline(
  f: BodyScanFeatures,
): Record<string, number | null> {
  const height = f.heightCm;
  const length = (value: number | null) =>
    value !== null && height !== null ? value * height : null;
  const circumference = (front: number | null, side: number | null) =>
    front !== null && side !== null && height !== null
      ? ellipseCircumference(front * height, side * height)
      : null;
  return {
    chestCm: circumference(f.chestFrontRatio, f.chestSideRatio),
    waistCm: circumference(f.waistFrontRatio, f.waistSideRatio),
    hipCm: circumference(f.hipFrontRatio, f.hipSideRatio),
    shoulderCm: length(f.shoulderWidthRatio),
    sleeveCm: length(f.armLengthRatio),
    torsoCm: length(f.torsoLengthRatio),
    inseamCm: null,
    neckCm: null,
  };
}
