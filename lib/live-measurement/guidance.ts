import { config as imageConfig } from '@/lib/measurement/config';
import { usable } from '@/lib/measurement/landmarks';
import { maskBounds } from '@/lib/vision/segmentation';
import type { Landmark, VisionFrame } from '@/lib/vision/types';
import { liveConfig as c } from './config';

export const poses = [
  {
    id: 'front',
    label: 'Front',
    instruction:
      'Stand facing the camera with your arms slightly away from your body.',
  },
  {
    id: 'extended',
    label: 'Arms extended',
    instruction: 'Extend your arms to the sides. Keep them straight.',
  },
  {
    id: 'side',
    label: 'Side',
    instruction:
      'Turn sideways and keep your arms slightly away from your body.',
  },
  {
    id: 'back',
    label: 'Back',
    instruction: 'Turn around so your back faces the camera.',
    tip: 'Keep your arms slightly away from your sides.',
  },
  {
    id: 'neck',
    label: 'Neck',
    instruction:
      'Face the camera, keep your shoulders relaxed, and hold your head upright.',
  },
] as const;
export type Pose = (typeof poses)[number]['id'];
export type Bounds = NonNullable<ReturnType<typeof maskBounds>>;
export type Point = readonly [number, number];

export const leftArm = [11, 13, 15] as const;
export const rightArm = [12, 14, 16] as const;

function point(frame: VisionFrame, landmark: Landmark): Point {
  return [landmark.x * frame.width, landmark.y * frame.height];
}

function corner(a: Point, b: Point, c: Point) {
  const left = [a[0] - b[0], a[1] - b[1]] as const;
  const right = [c[0] - b[0], c[1] - b[1]] as const;
  const scale = Math.hypot(...left) * Math.hypot(...right);
  if (scale === 0) return 0;
  const cosine = (left[0] * right[0] + left[1] * right[1]) / scale;
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

export function facing(frame: VisionFrame) {
  const [left, right] = [frame.landmarks[11], frame.landmarks[12]];
  if (!left || !right || (!usable(left) && !usable(right))) return 'unknown';
  if (![left.x, right.x, left.z, right.z].every(Number.isFinite))
    return 'unknown';
  // The anatomical left/right shoulder ordering distinguishes front and back in the unmirrored source.
  const yaw = Math.abs(
    (Math.atan2(right.z - left.z, left.x - right.x) * 180) / Math.PI,
  );
  if (yaw <= c.viewToleranceDegrees) return 'front';
  if (yaw >= 180 - c.viewToleranceDegrees) return 'back';
  if (yaw >= c.minSideYaw && yaw <= 180 - c.minSideYaw) return 'side';
  return 'unknown';
}

export function frameFraming(frame: VisionFrame): {
  bounds: Bounds | null;
  message: string | null;
} {
  const retry = (message: string) => ({ bounds: null, message });
  if (frame.poseCount !== 1) return retry('Keep one person in view.');
  if (frame.brightness < imageConfig.minBrightness)
    return retry('Use bright, even light.');
  if (frame.sharpness < imageConfig.minSharpness)
    return retry('Hold still and check that the camera is in focus.');
  const mask = frame.mask;
  const bounds = maskBounds(mask);
  if (!mask || !bounds || bounds.instability > imageConfig.maxMaskInstability)
    return retry(
      'Stand against a clear background so your outline is visible.',
    );

  const margin = c.margin;
  if (
    bounds.left < mask.width * margin ||
    bounds.right >= mask.width * (1 - margin) ||
    bounds.top < mask.height * margin ||
    bounds.bottom >= mask.height * (1 - margin) ||
    ![27, 28, 31, 32].some((i) => usable(frame.landmarks[i]))
  ) {
    return retry(
      'Move back so your whole body is in view, including your head and feet.',
    );
  }
  const fraction = bounds.height / mask.height;
  if (fraction < c.minimumBodyFraction)
    return retry('Move a little closer while keeping your whole body visible.');
  if (fraction > c.maximumBodyFraction)
    return retry('Move a little farther from the camera.');
  return { bounds, message: null };
}

function armPose(
  frame: VisionFrame,
  pose: 'front' | 'extended' | 'back' | 'neck',
) {
  return [leftArm, rightArm].every((indices, side) => {
    const [shoulder, elbow, wrist] = indices.map(
      (index) => frame.landmarks[index],
    );
    if (!usable(shoulder) || !usable(elbow) || !usable(wrist)) return false;
    const a = point(frame, shoulder);
    const b = point(frame, elbow);
    const w = point(frame, wrist);
    const direction = pose === 'back' ? side * 2 - 1 : 1 - side * 2;
    const outward = (w[0] - a[0]) * direction;
    const down = w[1] - a[1];
    const tilt = (Math.atan2(outward, down) * 180) / Math.PI;
    if (pose === 'extended') {
      return (
        Math.abs(tilt - 90) <= c.extendedArmDegrees &&
        corner(a, b, w) >= c.minimumElbowDegrees
      );
    }
    if (pose === 'neck')
      return down > 0 && Math.abs(tilt) <= c.raisedArmMaximumDegrees;
    return (
      tilt >= c.raisedArmMinimumDegrees && tilt <= c.raisedArmMaximumDegrees
    );
  });
}

export function poseFeedback(frame: VisionFrame, pose: Pose) {
  const needed = pose === 'extended' || pose === 'neck' ? 'front' : pose;
  if (facing(frame) !== needed) return 'Turn to match the requested view.';
  const p = frame.landmarks;
  const core = [
    [p[11], p[23]],
    [p[12], p[24]],
  ] as const;
  const aligned = core.map(
    ([top, bottom]) =>
      usable(top) &&
      usable(bottom) &&
      bottom.y > top.y &&
      Math.abs(bottom.x - top.x) < c.maximumLean,
  );
  if (pose === 'side' ? !aligned.some(Boolean) : !aligned.every(Boolean))
    return 'Stand upright with your shoulders over your hips.';
  if (pose !== 'side' && !armPose(frame, pose))
    return poses.find(({ id }) => id === pose)!.instruction;
  if (
    pose === 'neck' &&
    (!usable(p[7]) ||
      !usable(p[8]) ||
      !usable(p[0]) ||
      Math.abs(p[7].y - p[8].y) > c.maximumMotion ||
      Math.abs(p[0].x - (p[11].x + p[12].x) / 2) > c.maximumLean)
  )
    return 'Look straight ahead and keep your head upright.';
  return null;
}

export function motionBetween(
  current: readonly Landmark[],
  prior: readonly Landmark[],
) {
  return [11, 12, 13, 14, 15, 16, 23, 24].some(
    (i) =>
      usable(current[i]) &&
      usable(prior[i]) &&
      Math.hypot(current[i].x - prior[i].x, current[i].y - prior[i].y) >
        c.maximumMotion,
  );
}
