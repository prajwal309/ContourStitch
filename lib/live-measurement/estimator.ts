import { ellipseCircumference } from '@/lib/measurement/circumference';
import { landmarkPath, usable } from '@/lib/measurement/landmarks';
import { pixelScale } from '@/lib/measurement/scale';
import { median } from '@/lib/measurement/silhouette';
import { config as imageConfig } from '@/lib/measurement/config';
import {
  liveMeasurementKeys,
  type MeasurementEstimate,
  type MeasurementReport,
} from '@/lib/measurement/types';
import { rowSpan } from '@/lib/vision/segmentation';
import type { VisionFrame } from '@/lib/vision/types';
import { leftArm, rightArm, type Bounds, type Pose } from './guidance';
import { liveConfig as c } from './config';
import type { Calibration } from './calibration';

type Torso = 'chest' | 'waist' | 'hip';
type Dimension = Torso | 'neck';
type Sides = NonNullable<MeasurementEstimate['sidesCm']>;
export type SampleQuality = {
  landmarkConfidence: number;
  viewAlignment: number;
  imageQuality: number;
  segmentationStability: number;
  calibrationReliability: number;
  score: number;
};
export type Sample = {
  scale: number;
  widths: Partial<Record<Dimension, number>>;
  arms?: Sides;
  shoulder?: number;
  torsoCm?: number;
  quality?: SampleQuality;
};
type Views = Partial<Record<Pose, readonly Sample[]>>;

export interface LiveEstimator {
  sample(
    frame: VisionFrame,
    bounds: Bounds,
    pose: Pose,
    calibration: Calibration,
  ): Sample | null;
  report(
    views: Views,
    calibration: Calibration,
    options?: { allowPreliminary?: boolean },
  ): MeasurementReport;
}

function limbs(
  frame: VisionFrame,
  cmPerPixel: number,
  straight: boolean,
): Sides | undefined {
  const length = (indices: typeof leftArm | typeof rightArm) => {
    const selected = straight ? [indices[0], indices[2]] : indices;
    return landmarkPath(
      selected.map((index) => frame.landmarks[index]),
      frame.width,
      frame.height,
    );
  };
  const left = length(leftArm);
  const right = length(rightArm);
  return left && right
    ? { left: left * cmPerPixel, right: right * cmPerPixel }
    : undefined;
}

function torsoAnchors(frame: VisionFrame) {
  const p = frame.landmarks;
  const pairs = [
    [p[11], p[23]],
    [p[12], p[24]],
  ] as const;
  const valid = pairs.filter(
    ([top, bottom]) => usable(top) && usable(bottom) && bottom.y > top.y,
  );
  if (!valid.length) return null;
  return {
    from: valid.reduce((sum, [top]) => sum + top.y, 0) / valid.length,
    to: valid.reduce((sum, [, bottom]) => sum + bottom.y, 0) / valid.length,
    center:
      valid.reduce((sum, [top, bottom]) => sum + (top.x + bottom.x) / 2, 0) /
      valid.length,
  };
}

function armCrossesRow(
  frame: VisionFrame,
  row: number,
  left: number,
  right: number,
) {
  const p = frame.landmarks;
  return [leftArm, rightArm].some(([shoulder, elbow, wrist]) =>
    [
      [p[shoulder], p[elbow]],
      [p[elbow], p[wrist]],
    ].some(([a, b]) => {
      if (
        !usable(a) ||
        !usable(b) ||
        a.y === b.y ||
        row <= Math.min(a.y, b.y) ||
        row >= Math.max(a.y, b.y)
      )
        return false;
      const x = a.x + ((b.x - a.x) * (row - a.y)) / (b.y - a.y);
      return x >= left && x <= right;
    }),
  );
}

function uncontaminatedWidth(
  frame: VisionFrame,
  row: number,
  centerX: number,
  checkArms: boolean,
) {
  const mask = frame.mask;
  if (!mask) return null;
  const widths: number[] = [];
  const rowPixel = Math.round(row * mask.height);
  for (
    let delta = -imageConfig.sampleRadius;
    delta <= imageConfig.sampleRadius;
    delta++
  ) {
    const y = rowPixel + delta;
    const span = rowSpan(mask, y, centerX * mask.width);
    if (
      span &&
      (!checkArms ||
        !armCrossesRow(
          frame,
          y / mask.height,
          span.left / mask.width,
          span.right / mask.width,
        ))
    ) {
      widths.push(span.right - span.left + 1);
    }
  }
  return widths.length >= imageConfig.minSampleRows ? median(widths) : null;
}

function neckWidth(
  frame: VisionFrame,
  shoulderY: number,
  torsoX: number,
  torsoHeight: number,
) {
  const ears = [frame.landmarks[7], frame.landmarks[8]].filter(usable);
  if (!ears.length) return null;
  const earY = ears.reduce((sum, ear) => sum + ear.y, 0) / ears.length;
  const earX = ears.reduce((sum, ear) => sum + ear.x, 0) / ears.length;
  const band = shoulderY - earY;
  if (band < torsoHeight * c.minNeckBandFraction) return null;
  // MediaPipe has no neck-base landmark. Sample a band below the ears and compare with the same view's upper torso.
  const neck = uncontaminatedWidth(
    frame,
    earY + band * c.neckSamplingFraction,
    (earX + torsoX) / 2,
    false,
  );
  const upperTorso = uncontaminatedWidth(
    frame,
    shoulderY + torsoHeight * imageConfig.sampleFractions.chest,
    torsoX,
    false,
  );
  return neck && upperTorso && neck < upperTorso ? neck : null;
}

function bounded(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sampleQuality(
  frame: VisionFrame,
  bounds: Bounds,
  pose: Pose,
  calibration: Calibration,
): SampleQuality {
  const indices =
    pose === 'side'
      ? [11, 12, 23, 24, 13, 14, 15, 16]
      : [11, 12, 13, 14, 15, 16, 23, 24];
  const landmarkConfidence =
    indices.reduce(
      (sum, index) => sum + (usable(frame.landmarks[index]) ? frame.landmarks[index].visibility : 0),
      0,
    ) / indices.length;

  const left = frame.landmarks[11];
  const right = frame.landmarks[12];
  const yaw =
    usable(left) && usable(right)
      ? Math.abs(
          (Math.atan2(right.z - left.z, left.x - right.x) * 180) / Math.PI,
        )
      : 180;
  const targetYaw =
    pose === 'back' ? 180 : pose === 'side' ? 90 : 0;
  const viewAlignment = bounded(
    1 - Math.abs(yaw - targetYaw) / c.viewToleranceDegrees,
  );
  const imageQuality =
    (Math.min(
      1,
      frame.brightness /
        (imageConfig.minBrightness * c.progressive.imageQualitySaturation),
    ) +
      Math.min(
        1,
        frame.sharpness /
          (imageConfig.minSharpness * c.progressive.imageQualitySaturation),
      )) /
    2;
  const segmentationStability = bounded(
    1 - bounds.instability / imageConfig.maxMaskInstability,
  );
  const calibrationReliability =
    calibration.kind === 'reference'
      ? c.progressive.referenceCalibrationWeight
      : c.progressive.heightCalibrationWeight;
  const factors = [
    bounded(landmarkConfidence),
    viewAlignment,
    imageQuality,
    segmentationStability,
    calibrationReliability,
  ];

  return {
    landmarkConfidence,
    viewAlignment,
    imageQuality,
    segmentationStability,
    calibrationReliability,
    score: Math.pow(factors.reduce((product, factor) => product * factor, 1), 1 / factors.length),
  };
}

function sample(
  frame: VisionFrame,
  bounds: Bounds,
  pose: Pose,
  calibration: Calibration,
): Sample | null {
  const mask = frame.mask;
  if (!mask) return null;
  const cmPerPixel = pixelScale(
    calibration.heightCm,
    (bounds.height * frame.height) / mask.height,
  );
  if (!cmPerPixel) return null;

  const evidence: Sample = {
    scale: bounds.height / mask.height,
    widths: {},
    quality: sampleQuality(frame, bounds, pose, calibration),
  };
  if (pose === 'front' || pose === 'back' || pose === 'extended') {
    evidence.arms = limbs(frame, cmPerPixel, pose === 'extended');
  }
  if (pose === 'front') {
    const shoulders = landmarkPath(
      [frame.landmarks[11], frame.landmarks[12]],
      frame.width,
      frame.height,
    );
    if (shoulders !== null) evidence.shoulder = shoulders * cmPerPixel;
  }
  if (pose === 'extended') return evidence;
  const torso = torsoAnchors(frame);
  if (!torso) return evidence;
  const torsoHeight = torso.to - torso.from;
  const maskToCm = (cmPerPixel * frame.width) / mask.width;
  if (pose === 'front' || pose === 'back')
    evidence.torsoCm = torsoHeight * cmPerPixel;

  if (pose !== 'neck') {
    for (const key of ['chest', 'waist', 'hip'] as const) {
      const row = torso.from + torsoHeight * imageConfig.sampleFractions[key];
      const width = uncontaminatedWidth(frame, row, torso.center, true);
      if (width !== null) evidence.widths[key] = width * maskToCm;
    }
  }
  if (pose === 'side' || pose === 'neck') {
    const width = neckWidth(frame, torso.from, torso.center, torsoHeight);
    if (width !== null) evidence.widths.neck = width * maskToCm;
  }
  return evidence;
}

function stable(
  samples: readonly Sample[] | undefined,
  read: (sample: Sample) => number | undefined,
  allowPreliminary = false,
) {
  const values = (samples ?? [])
    .flatMap((sample) => {
      const value = read(sample);
      return value !== undefined && Number.isFinite(value) && value > 0
        ? [value]
        : [];
    })
    .sort((a, b) => a - b);
  const middle = median(values);
  if (
    middle === null ||
    values.length < (allowPreliminary ? 1 : c.minimumFrames)
  )
    return null;
  const low = values[Math.floor((values.length - 1) / 5)];
  const high = values[Math.ceil(((values.length - 1) * 4) / 5)];
  return (high - low) / middle <= c.maximumSpread ? middle : null;
}

function consistent(a: number, b: number) {
  return Math.abs(a - b) / Math.max(a, b) <= c.crossViewTolerance;
}

function report(
  views: Views,
  calibration: Calibration,
  options: { allowPreliminary?: boolean } = {},
): MeasurementReport {
  const allowPreliminary = options.allowPreliminary ?? false;
  const result: MeasurementReport = {
    source: 'live-video',
    estimates: [],
    missing: {},
  };
  const scaleNote =
    calibration.kind === 'reference'
      ? 'scaled with your reference object'
      : 'scaled from your entered height';

  function add(
    key: MeasurementEstimate['key'],
    valueCm: number | null,
    method: string,
    missing: string,
    sidesCm?: Sides,
  ) {
    if (valueCm === null || valueCm <= 0 || valueCm > 300) {
      result.missing[key] = missing;
      return;
    }
    result.estimates.push({
      key,
      valueCm,
      method: `${method} · ${scaleNote}`,
      confidence: 'low',
      uncertaintyCm: null,
      ...(sidesCm && { sidesCm }),
      warnings: [
        'Experimental video estimate. Confirm with a tape before garment production.',
        ...(sidesCm &&
        Math.abs(sidesCm.left - sidesCm.right) >= c.asymmetryNoticeCm
          ? [
              'The left and right estimates differ. Check both arms with a tape.',
            ]
          : []),
      ],
    });
  }

  function armAndSleeve(pose: 'extended' | 'front') {
    const left = stable(views[pose], (s) => s.arms?.left, allowPreliminary);
    const right = stable(views[pose], (s) => s.arms?.right, allowPreliminary);
    if (!left || !right) return undefined;
    if (pose === 'extended') return { left, right };
    const rearLeft = stable(views.back, (s) => s.arms?.left, allowPreliminary);
    const rearRight = stable(
      views.back,
      (s) => s.arms?.right,
      allowPreliminary,
    );
    if (
      (rearLeft && !consistent(left, rearLeft)) ||
      (rearRight && !consistent(right, rearRight))
    )
      return undefined;
    return {
      left: rearLeft ? (left + rearLeft) / 2 : left,
      right: rearRight ? (right + rearRight) / 2 : right,
    };
  }

  const arm = armAndSleeve('extended');
  const sleeve = armAndSleeve('front');
  const shoulder = stable(views.front, (s) => s.shoulder, allowPreliminary);
  add(
    'shoulder',
    shoulder,
    'Front-view shoulder-joint distance, a proxy for shoulder breadth',
    'Needs a clear front view, visible shoulder landmarks, and scale calibration. Verify the shoulder-breadth convention with a tape.',
  );
  add(
    'arm',
    arm ? (arm.left + arm.right) / 2 : null,
    'Bilateral straight shoulder joint to wrist distance with arms extended',
    'Needs a clear, stable arms-extended pose. You can enter it with a tape.',
    arm,
  );
  add(
    'sleeve',
    sleeve ? (sleeve.left + sleeve.right) / 2 : null,
    'Shoulder landmark to wrist following the elbow. The shoulder landmark approximates the sleeve starting point.',
    'Needs a stable shoulder, elbow and wrist path. You can enter it with a tape.',
    sleeve,
  );

  const sideScale = stable(views.side, (s) => s.scale, allowPreliminary);
  for (const key of ['chest', 'waist', 'hip', 'neck'] as const) {
    const widthPose = key === 'neck' ? 'neck' : 'front';
    const frontal = stable(
      views[widthPose],
      (s) => s.widths[key],
      allowPreliminary,
    );
    const side = stable(views.side, (s) => s.widths[key], allowPreliminary);
    const rear =
      key === 'neck'
        ? null
        : stable(views.back, (s) => s.widths[key], allowPreliminary);
    const frontScale = stable(
      views[widthPose],
      (s) => s.scale,
      allowPreliminary,
    );
    const matchedScale =
      frontScale && sideScale && consistent(frontScale, sideScale);
    const agreed = frontal && (!rear || consistent(frontal, rear));
    const width = frontal && rear ? (frontal + rear) / 2 : frontal;
    const value =
      matchedScale && agreed && width && side
        ? ellipseCircumference(width, side)
        : null;

    add(
      key,
      value,
      key === 'neck'
        ? 'Experimental ellipse fit to the relaxed front and side silhouette near the base of the neck'
        : 'Experimental ellipse fit to repeatable front width and side depth at landmark-relative torso levels',
      key === 'neck'
        ? 'Needs a clear neck outline from both views and a consistent scale. A tape is recommended.'
        : 'Needs consistent front and side silhouettes at the same distance. Verify with a tape.',
    );
  }

  result.estimates.sort(
    (a, b) =>
      liveMeasurementKeys.findIndex((key) => key === a.key) -
      liveMeasurementKeys.findIndex((key) => key === b.key),
  );
  return result;
}

export const silhouetteEstimator: LiveEstimator = { sample, report };
