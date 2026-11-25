import { config as image } from '@/lib/measurement/config';
import { landmarkPath, usable } from '@/lib/measurement/landmarks';
import { median } from '@/lib/measurement/silhouette';
import type { Landmark, VisionFrame } from '@/lib/vision/types';
import { liveConfig } from '../config';
import { neckWidth, uncontaminatedWidth } from '../estimator';
import { leftArm, rightArm, silhouetteQuality } from '../guidance';
import { multiViewConfig as c } from './config';

export const sections = ['chest', 'waist', 'hip', 'neck'] as const;
export type Section = (typeof sections)[number];
export const paths = ['shoulder', 'arm', 'sleeve', 'torso', 'outseam'] as const;
export type Path = (typeof paths)[number];
export type Anchor = 'torso' | 'thigh';
export type Paths = Partial<Record<Path, readonly number[]>>;

export type RegionObservation = {
  anchor: Anchor;
  /** Candidate scale transfer from an uncropped standing frame. */
  statureRatio?: number;
  anchorPixels: number;
  widths: Partial<Record<Section, number>>;
  paths: Paths;
  quality: number;
};

export type FrameObservation = {
  timestamp: number;
  yaw: number | null;
  regions: RegionObservation[];
  message?: string;
};

const radians = Math.PI / 180;
const pairs = {
  torso: [
    [11, 23],
    [12, 24],
  ],
  thigh: [
    [23, 25],
    [24, 26],
  ],
} as const;

function yawFrom(a: Landmark, b: Landmark) {
  if (
    (!usable(a) && !usable(b)) ||
    ![a, b].every(
      ({ x, y, z, visibility }) =>
        Number.isFinite(z) &&
        x > 0 &&
        x < 1 &&
        y > 0 &&
        y < 1 &&
        visibility >= 0.2,
    ) ||
    Math.hypot(a.x - b.x, a.z - b.z) < 0.025
  )
    return null;
  return Math.atan2(b.z - a.z, a.x - b.x) / radians;
}

function stableAnchor(frame: VisionFrame, anchor: Anchor) {
  const valid = pairs[anchor].flatMap(([top, bottom]) => {
    const a = frame.landmarks[top];
    const b = frame.landmarks[bottom];
    if (!usable(a) || !usable(b)) return [];
    const span = b.y - a.y;
    if (
      span < c.minimumAnchorFraction ||
      Math.abs(b.x - a.x) * frame.width >
        span * frame.height * c.maximumAnchorLean
    )
      return [];
    return [{ a, b, span }];
  });
  if (!valid.length) return null;
  return {
    valid,
    span: median(valid.map(({ span }) => span))!,
    from: median(valid.map(({ a }) => a.y))!,
    to: median(valid.map(({ b }) => b.y))!,
    confidence: Math.min(
      ...valid.flatMap(({ a, b }) => [a.visibility, b.visibility]),
    ),
  };
}

function extended(
  frame: VisionFrame,
  indices: typeof leftArm | typeof rightArm,
) {
  const [shoulder, elbow, wrist] = indices.map(
    (index) => frame.landmarks[index],
  );
  if (![shoulder, elbow, wrist].every(usable)) return false;
  const opposite = frame.landmarks[indices === leftArm ? 12 : 11];
  if (!usable(opposite)) return false;
  const direct =
    landmarkPath([shoulder, wrist], frame.width, frame.height) ?? 0;
  const viaElbow = landmarkPath(
    [shoulder, elbow, wrist],
    frame.width,
    frame.height,
  );
  return (
    !!viaElbow &&
    direct / viaElbow >= 0.98 &&
    Math.abs(wrist.y - shoulder.y) * frame.height <= direct * 0.34 &&
    (wrist.x - shoulder.x) * (shoulder.x - opposite.x) > 0
  );
}

/** Pixel dimensions are normalized to one visible anatomical segment, never to cropped mask height. */
export function observeFrame(frame: VisionFrame): FrameObservation {
  const empty = { timestamp: frame.timestamp, yaw: null, regions: [] };
  if (
    !Number.isFinite(frame.timestamp) ||
    frame.width <= 0 ||
    frame.height <= 0
  )
    return empty;
  const { bounds, message } = silhouetteQuality(frame);
  const mask = frame.mask;
  if (!bounds || !mask) return { ...empty, message: message ?? undefined };
  const p = frame.landmarks;
  const yaw =
    (p[11] && p[12] ? yawFrom(p[11], p[12]) : null) ??
    (p[23] && p[24] ? yawFrom(p[23], p[24]) : null);
  if (yaw === null)
    return { ...empty, message: 'Keep your shoulders or hips in view.' };

  const facing = Math.min(Math.abs(yaw), 180 - Math.abs(yaw));
  const nearFront = facing <= liveConfig.viewToleranceDegrees;
  const hasHeight =
    bounds.top >= mask.height * liveConfig.margin &&
    bounds.bottom < mask.height * (1 - liveConfig.margin) &&
    bounds.height / mask.height >= liveConfig.minimumBodyFraction &&
    usable(p[0]) &&
    p[0].y * mask.height < bounds.top + bounds.height * 0.25 &&
    [27, 28].some(
      (index) =>
        usable(p[index]) &&
        p[index].y * mask.height >= bounds.top + bounds.height * 0.84,
    ) &&
    (nearFront || facing >= liveConfig.minSideYaw);

  const regions: RegionObservation[] = [];
  for (const anchor of ['torso', 'thigh'] as const) {
    const geometry = stableAnchor(frame, anchor);
    if (!geometry) continue;
    const { valid, span, from, to, confidence } = geometry;
    const scalePixels = span * frame.height;
    const region: RegionObservation = {
      anchor,
      anchorPixels: scalePixels,
      ...(hasHeight && {
        statureRatio: (span * mask.height) / bounds.height,
      }),
      widths: {},
      paths: {},
      quality: Math.max(
        0.05,
        confidence *
          (1 - bounds.instability / image.maxMaskInstability) *
          Math.min(1, frame.brightness / (image.minBrightness * 2)) *
          Math.min(1, frame.sharpness / (image.minSharpness * 2)),
      ),
    };
    const centerAt = (y: number) =>
      median(
        valid.map(({ a, b }) => a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)),
      )!;
    const addWidth = (key: Section, raw: number | null) => {
      if (raw && raw / mask.width >= c.minimumMaskSpanFraction)
        region.widths[key] = (raw * frame.width) / mask.width / scalePixels;
    };
    const sample = (key: Section, y: number) =>
      addWidth(
        key,
        uncontaminatedWidth(frame, y, centerAt(y), true, liveConfig.margin),
      );

    if (anchor === 'torso') {
      sample('chest', from + span * image.sampleFractions.chest);
      sample('waist', from + span * image.sampleFractions.waist);
      sample('hip', to);
      addWidth(
        'neck',
        neckWidth(frame, from, centerAt(from), span, liveConfig.margin),
      );
      if (nearFront) {
        const length = (indices: readonly number[]) =>
          landmarkPath(
            indices.map((index) => p[index]),
            frame.width,
            frame.height,
          );
        const shoulder = length([11, 12]);
        if (shoulder) region.paths.shoulder = [shoulder / scalePixels];
        const sleeves = [length(leftArm), length(rightArm)];
        if (sleeves.every((value) => value !== null && value > 0))
          region.paths.sleeve = sleeves.map((value) => value! / scalePixels);
        if (extended(frame, leftArm) && extended(frame, rightArm)) {
          const arms = [length([11, 15]), length([12, 16])];
          if (arms.every((value) => value !== null && value > 0))
            region.paths.arm = arms.map((value) => value! / scalePixels);
        }
        if (valid.length === 2) region.paths.torso = [1];
      }
    } else {
      sample('hip', from);
      if (nearFront) {
        const legPaths = [
          [23, 25, 27],
          [24, 26, 28],
        ].map((indices) =>
          landmarkPath(
            indices.map((index) => p[index]),
            frame.width,
            frame.height,
          ),
        );
        if (legPaths.every((value) => value !== null && value > 0))
          region.paths.outseam = legPaths.map((value) => value! / scalePixels);
      }
    }
    if (
      region.statureRatio ||
      Object.keys(region.widths).length ||
      Object.keys(region.paths).length
    )
      regions.push(region);
  }

  return { timestamp: frame.timestamp, yaw, regions };
}
