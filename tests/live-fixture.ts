import type { VisionFrame } from '@/lib/vision/types';
import type { Pose } from '@/lib/live-measurement/guidance';

// Self-contained so Playwright can install the same fixture in the browser.
export function liveFrame(pose: Pose, timestamp = 0): VisionFrame {
  const width = 320;
  const height = 400;
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.14,
    z: 0,
    visibility: 0.99,
  }));
  const p = (index: number, x: number, y: number, z = 0, visibility = 0.99) => {
    landmarks[index] = { x, y, z, visibility };
  };
  p(0, 0.5, 0.13);
  p(7, 0.54, 0.18);
  p(8, 0.46, 0.18);
  p(11, 0.64, 0.27);
  p(12, 0.36, 0.27);
  p(13, 0.69, 0.42);
  p(14, 0.31, 0.42);
  p(15, 0.76, 0.56);
  p(16, 0.24, 0.56);
  p(23, 0.61, 0.56);
  p(24, 0.39, 0.56);
  p(27, 0.58, 0.88);
  p(28, 0.42, 0.88);
  p(31, 0.59, 0.91);
  p(32, 0.41, 0.91);

  if (pose === 'extended') {
    p(13, 0.79, 0.27);
    p(14, 0.22, 0.27);
    p(15, 0.95, 0.27);
    p(16, 0.09, 0.27);
  }
  if (pose === 'back') for (const item of landmarks) item.x = 1 - item.x;
  if (pose === 'neck') {
    p(15, 0.64, 0.57);
    p(16, 0.36, 0.57);
  }
  if (pose === 'side') {
    p(11, 0.53, 0.27, -0.18);
    p(12, 0.49, 0.27, 0.18, 0.3);
    p(23, 0.53, 0.56);
    p(24, 0.49, 0.56, 0.1, 0.3);
    p(13, 0.69, 0.29);
    p(15, 0.72, 0.37);
    p(14, 0.45, 0.3, 0, 0.3);
    p(16, 0.45, 0.39, 0, 0.3);
    p(8, 0.47, 0.18, 0.1, 0.3);
  }

  const data = new Float32Array(width * height);
  for (let y = 34; y < 367; y++) {
    const half =
      y < 82 ? 23 : y < 106 ? 15 : y < 248 ? (pose === 'side' ? 28 : 49) : 33;
    for (let x = 160 - half; x <= 160 + half; x++) data[y * width + x] = 1;
  }

  return {
    width,
    height,
    timestamp,
    landmarks,
    poseCount: 1,
    mask: { width, height, data },
    brightness: 145,
    sharpness: 110,
  };
}
