import { config as imageConfig } from '@/lib/measurement/config';
import { usable } from '@/lib/measurement/landmarks';
import { maskBounds } from '@/lib/vision/segmentation';
import type { Landmark, VisionFrame } from '@/lib/vision/types';
import { liveConfig as c } from './config';

export const poses = [
  {
    id: 'front',
    label: 'Front',
    instruction: 'Stand facing the camera.',
  },
  {
    id: 'extended',
    label: 'Arms extended',
    instruction: 'Move your arms out to your sides and keep them straight.',
  },
  {
    id: 'side',
    label: 'Side',
    instruction: 'Turn 90 degrees to your right.',
  },
  {
    id: 'back',
    label: 'Back',
    instruction: 'Turn around to your right so your back faces the camera.',
  },
  {
    id: 'neck',
    label: 'Neck',
    instruction: 'Face the camera. Relax your shoulders and stand straight.',
  },
] as const;
export type Pose = (typeof poses)[number]['id'];
export type Bounds = NonNullable<ReturnType<typeof maskBounds>>;
export type Point = readonly [number, number];

export const leftArm = [11, 13, 15] as const;
export const rightArm = [12, 14, 16] as const;

function shoulderYaw(frame: VisionFrame) {
  const [left, right] = [frame.landmarks[11], frame.landmarks[12]];
  if (!left || !right || (!usable(left) && !usable(right))) return null;
  if (![left.x, right.x, left.z, right.z].every(Number.isFinite)) return null;
  return (Math.atan2(right.z - left.z, left.x - right.x) * 180) / Math.PI;
}

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
  const angle = shoulderYaw(frame);
  if (angle === null) return 'unknown';
  // Use unmirrored source landmarks so a mirrored preview cannot reverse turn directions.
  const yaw = Math.abs(angle);
  if (yaw <= c.viewToleranceDegrees) return 'front';
  if (yaw >= 180 - c.viewToleranceDegrees) return 'back';
  if (yaw >= c.minSideYaw && yaw <= 180 - c.minSideYaw) return 'side';
  return 'unknown';
}

function orientationInstruction(frame: VisionFrame, pose: Pose) {
  const yaw = shoulderYaw(frame);
  const current = facing(frame);

  if (pose === 'side') {
    if (yaw === null || Math.abs(yaw) <= c.viewToleranceDegrees)
      return 'Turn 90 degrees to your right.';
    if (yaw > 0)
      return 'Turn back to face the camera, then turn 90 degrees to your right.';
    if (yaw < -c.minSideYaw)
      return 'Turn slightly to your left until your side faces the camera.';
    return 'Turn a little more to your right.';
  }

  if (pose === 'back') {
    if (current === 'front')
      return 'Turn around to your right until your back faces the camera.';
    if (yaw !== null && yaw < 0)
      return 'Keep turning to your right until your back faces the camera.';
    return 'Turn back to face the camera, then turn around to your right.';
  }

  if (current === 'back') return 'Turn around to face the camera.';
  if (yaw === null) return 'Face the camera and keep both shoulders visible.';
  return yaw < 0
    ? 'Turn slightly to your left until you face the camera.'
    : 'Turn slightly to your right until you face the camera.';
}

export function silhouetteQuality(frame: VisionFrame): {
  bounds: Bounds | null;
  message: string | null;
} {
  const retry = (message: string) => ({ bounds: null, message });
  if (frame.poseCount !== 1)
    return retry(
      'Stand in front of the camera. Make sure only you are in view.',
    );
  if (frame.brightness < imageConfig.minBrightness)
    return retry('Use bright, even light.');
  if (frame.sharpness < imageConfig.minSharpness)
    return retry('Hold still. Check that the camera is in focus.');
  const mask = frame.mask;
  const bounds = maskBounds(mask);
  if (!mask || !bounds || bounds.instability > imageConfig.maxMaskInstability)
    return retry(
      'Stand against a clear background so your outline is visible.',
    );

  return { bounds, message: null };
}

export function frameFraming(frame: VisionFrame) {
  const quality = silhouetteQuality(frame);
  const { bounds } = quality;
  const mask = frame.mask;
  if (!bounds || !mask) return quality;
  const retry = (message: string) => ({ bounds: null, message });
  const margin = c.margin;
  if (
    bounds.left < mask.width * margin ||
    bounds.right >= mask.width * (1 - margin) ||
    bounds.top < mask.height * margin ||
    bounds.bottom >= mask.height * (1 - margin) ||
    ![27, 28, 31, 32].some((i) => usable(frame.landmarks[i]))
  ) {
    return retry('Take a step back until your head and both feet are in view.');
  }
  const fraction = bounds.height / mask.height;
  if (fraction < c.minimumBodyFraction)
    return retry('Take a step forward while keeping your whole body in view.');
  if (fraction > c.maximumBodyFraction)
    return retry('Take a step back while keeping your whole body in view.');
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
  const yaw = shoulderYaw(frame);
  if (facing(frame) !== needed || (pose === 'side' && yaw !== null && yaw > 0))
    return orientationInstruction(frame, pose);
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
    return 'Stand straight and keep your shoulders over your hips.';
  if (pose !== 'side' && !armPose(frame, pose))
    return pose === 'extended'
      ? 'Move your arms out to your sides and keep them straight.'
      : pose === 'neck'
        ? 'Relax your shoulders and keep your arms at your sides.'
        : 'Move your arms slightly away from your body.';
  if (
    pose === 'neck' &&
    (!usable(p[7]) ||
      !usable(p[8]) ||
      !usable(p[0]) ||
      Math.abs(p[7].y - p[8].y) > c.maximumMotion ||
      Math.abs(p[0].x - (p[11].x + p[12].x) / 2) > c.maximumLean)
  )
    return 'Look straight ahead. Relax your shoulders and keep your head upright.';
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
