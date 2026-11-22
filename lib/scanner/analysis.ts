import type { VisionFrame } from '@/lib/vision/types';
import { maskBounds } from '@/lib/vision/segmentation';
import { scanConfig as c } from './config';
import type { FrameAnalysis, BodyOrientation, InstructionId } from './types';
export const angleDelta = (next: number, previous: number) =>
  ((next - previous + 540) % 360) - 180;
export function orientation(angle: number | null): BodyOrientation {
  if (angle === null) return 'UNKNOWN';
  const a = (angle + 360) % 360;
  return a <= c.viewToleranceDegrees || a >= 360 - c.viewToleranceDegrees
    ? 'FRONT'
    : Math.abs(a - 90) <= c.viewToleranceDegrees
      ? 'LEFT_SIDE'
      : Math.abs(a - 180) <= c.viewToleranceDegrees
        ? 'BACK'
        : Math.abs(a - 270) <= c.viewToleranceDegrees
          ? 'RIGHT_SIDE'
          : 'UNKNOWN';
}
export function analyzeFrame(
  frame: VisionFrame,
  previous: VisionFrame | null,
  previousAngle: number | null,
): FrameAnalysis {
  const p = frame.landmarks;
  const visible = (i: number) =>
    !!p[i] &&
    Number.isFinite(p[i].x) &&
    Number.isFinite(p[i].y) &&
    p[i].visibility >= c.minimumVisibility;
  const core = [11, 12, 23, 24];
  const poseConfidence = core.every(visible)
    ? Math.min(...core.map((i) => p[i].visibility))
    : 0;
  const bounds = maskBounds(frame.mask);
  const points = p.filter((point) => point.visibility >= c.minimumVisibility);
  const box =
    bounds && frame.mask
      ? {
          left: bounds.left / frame.mask.width,
          right: bounds.right / frame.mask.width,
          top: bounds.top / frame.mask.height,
          bottom: bounds.bottom / frame.mask.height,
        }
      : points.length
        ? {
            left: Math.min(...points.map((p) => p.x)),
            right: Math.max(...points.map((p) => p.x)),
            top: Math.min(...points.map((p) => p.y)),
            bottom: Math.max(...points.map((p) => p.y)),
          }
        : null;
  const bodyHeight = box ? box.bottom - box.top : 0;
  const center = core.every(visible)
    ? core.reduce((sum, i) => sum + p[i].x, 0) / 4
    : 0.5;
  const centered = Math.abs(center - 0.5) <= c.centerTolerance;
  const full =
    !!box &&
    box.top > c.margin &&
    box.bottom < 1 - c.margin &&
    box.left > c.margin &&
    box.right < 1 - c.margin &&
    [27, 28, 31, 32].every((i) => visible(i) && p[i].y < 1 - c.margin) &&
    [0, 7, 8].some((i) => visible(i) && p[i].y > c.margin);
  let angle: number | null = null;
  if (core.every(visible) && [p[11].z, p[12].z].every(Number.isFinite)) {
    // Signed shoulder axis in MediaPipe normalized x/z. Depth is inferred, not calibrated.
    const raw =
      ((Math.atan2(p[11].z - p[12].z, p[12].x - p[11].x) * 180) / Math.PI +
        360) %
      360;
    angle =
      previousAngle === null
        ? raw
        : (previousAngle + c.smoothing * angleDelta(raw, previousAngle) + 360) %
          360;
  }
  const category = orientation(angle);
  const motion =
    previous && core.every((i) => visible(i) && previous.landmarks[i])
      ? Math.max(
          ...core.map((i) =>
            Math.hypot(
              p[i].x - previous.landmarks[i].x,
              p[i].y - previous.landmarks[i].y,
            ),
          ),
        )
      : 0;
  const lean = core.every(visible)
    ? Math.abs((p[11].x + p[12].x - p[23].x - p[24].x) / 2)
    : 1;
  const arms = [15, 16].every(
    (i) =>
      visible(i) &&
      Math.abs(p[i].x - center) >
        Math.abs(p[23]?.x - p[24]?.x) / 2 + c.minArmGap,
  );
  let instruction: InstructionId | null = null;
  if (frame.poseCount !== 1 || poseConfidence < c.minimumVisibility)
    instruction = 'FIND_PERSON';
  else if (!full) instruction = 'SHOW_FULL_BODY';
  else if (bodyHeight > c.maxBodyHeight) instruction = 'MOVE_BACK';
  else if (bodyHeight < c.minBodyHeight) instruction = 'MOVE_CLOSER';
  else if (!centered) instruction = center < 0.5 ? 'MOVE_RIGHT' : 'MOVE_LEFT';
  else if (lean > c.maxLean) instruction = 'STAND_STRAIGHT';
  else if (category === 'FRONT' && !arms) instruction = 'ARMS_OUT';
  else if (
    frame.brightness < c.minBrightness ||
    frame.sharpness < c.minSharpness
  )
    instruction = 'IMPROVE_LIGHT';
  const framingScore =
    full &&
    centered &&
    bodyHeight >= c.minBodyHeight &&
    bodyHeight <= c.maxBodyHeight
      ? 1
      : 0;
  const orientationScore =
    angle === null ? 0 : category === 'UNKNOWN' ? 0.4 : 1;
  const quality = instruction
    ? 0
    : Math.min(
        poseConfidence,
        framingScore,
        orientationScore,
        Math.max(0, 1 - motion / c.rotationMotionLimit),
        bounds ? 1 - bounds.instability : 0.75,
      );
  return {
    timestamp: frame.timestamp,
    orientation: category,
    angle,
    orientationScore,
    framingScore,
    poseConfidence,
    motionScore: motion,
    quality,
    instruction,
    bounds: box,
  };
}
