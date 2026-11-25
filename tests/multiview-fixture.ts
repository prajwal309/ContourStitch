import type { VisionFrame } from '@/lib/vision/types';

export type SyntheticBody = {
  height: number;
  chest: [number, number];
  waist: [number, number];
  hip: [number, number];
};

type Options = {
  crop?: 'upper' | 'lower' | 'left';
  zoom?: number;
  size?: number;
  occluded?: boolean;
  looseClothing?: boolean;
  timestamp?: number;
  missing?: number[];
  farVisibility?: number;
  armPose?: 'extended' | 'relaxed';
  offset?: number;
  brightness?: number;
  sharpness?: number;
};

/** Orthographic projection of a 3D volume with elliptical horizontal sections. */
export function syntheticFrame(
  body: SyntheticBody,
  yaw: number,
  options: Options = {},
): VisionFrame {
  const {
    crop,
    zoom = 1,
    size = 192,
    occluded = false,
    looseClothing = false,
    timestamp = 100,
    missing = [],
    farVisibility = 0.45,
    armPose,
    offset = 0,
    brightness = 140,
    sharpness = 110,
  } = options;
  const angle = (yaw * Math.PI) / 180;
  const bodyFraction = 0.82 * zoom;
  const top =
    crop === 'lower'
      ? -0.34 * zoom
      : crop === 'upper'
        ? 0.12
        : (1 - bodyFraction) / 2;
  const scale = bodyFraction / body.height;
  const center = (crop === 'left' ? 0.03 : 0.5) + offset;
  const landmark = (x: number, y: number, z = 0) => ({
    x: center + scale * (x * Math.cos(angle) + z * Math.sin(angle)),
    y: top + bodyFraction * y,
    z: scale * (-x * Math.sin(angle) + z * Math.cos(angle)),
    visibility:
      Math.abs(Math.sin(angle)) > 0.75 && x < 0 ? farVisibility : 0.99,
  });
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  const points = [
    [0, 0, 0.07, 8],
    [7, 5, 0.13],
    [8, -5, 0.13],
    [11, 19, 0.25],
    [12, -19, 0.25],
    [13, 28, 0.42, 25],
    [14, -28, 0.42, 25],
    [15, 42, 0.54, 25],
    [16, -42, 0.54, 25],
    [23, 14, 0.56],
    [24, -14, 0.56],
    [25, 12, 0.76],
    [26, -12, 0.76],
    [27, 12, 0.96],
    [28, -12, 0.96],
    [31, 12, 0.99],
    [32, -12, 0.99],
  ] as const;
  for (const [i, x, y, z] of points) {
    if (!missing.includes(i)) landmarks[i] = landmark(x, y, z);
  }
  if (Math.abs(Math.sin(angle)) >= 0.86) {
    landmarks[13] = landmark(28, 0.285, 29);
    landmarks[14] = landmark(-28, 0.285, 29);
    landmarks[15] = landmark(42, 0.42, 29);
    landmarks[16] = landmark(-42, 0.42, 29);
  }
  if (armPose === 'extended') {
    landmarks[13] = landmark(32, 0.25);
    landmarks[14] = landmark(-32, 0.25);
    landmarks[15] = landmark(46, 0.25);
    landmarks[16] = landmark(-46, 0.25);
  } else if (armPose === 'relaxed') {
    landmarks[15] = landmark(19, 0.55, 25);
    landmarks[16] = landmark(-19, 0.55, 25);
  }
  if (occluded) {
    landmarks[13] = landmark(1, 0.32);
    landmarks[15] = landmark(1, 0.55);
  }

  const data = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    const y = ((row + 0.5) / size - top) / bodyFraction;
    if (y < 0 || y > 1) continue;
    const [width, depth] =
      y < 0.16
        ? [16, 18]
        : y < 0.23
          ? [12, 11]
          : y < 0.378
            ? body.chest
            : y < 0.49
              ? body.waist
              : y < 0.63
                ? body.hip
                : [32, 19];
    const cloth = looseClothing && y >= 0.23 && y <= 0.63 ? 1.13 : 1;
    const projected =
      cloth * Math.hypot(width * Math.cos(angle), depth * Math.sin(angle));
    const radius = (projected * scale) / 2;
    const left = Math.max(0, Math.ceil((center - radius) * size - 0.5));
    const right = Math.min(
      size,
      Math.floor((center + radius) * size - 0.5) + 1,
    );
    data.fill(1, row * size + left, row * size + right);
  }
  return {
    width: size,
    height: size,
    timestamp,
    landmarks,
    mask: { width: size, height: size, data },
    poseCount: 1,
    brightness,
    sharpness,
  };
}
