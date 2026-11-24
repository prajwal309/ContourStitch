import { config } from '@/lib/measurement/config';
import { maskBounds } from '@/lib/vision/segmentation';
import type { VisionFrame } from '@/lib/vision/types';
import type { SilhouetteObservation } from './types';

export const normalizedSilhouetteSize = 64;

export function normalizeSilhouette(
  frame: VisionFrame,
  angleDegrees: number,
  quality: number,
): SilhouetteObservation | null {
  const mask = frame.mask;
  const bounds = maskBounds(mask);
  if (!mask || !bounds || !Number.isFinite(angleDegrees)) return null;
  const size = normalizedSilhouetteSize;
  const data = new Uint8Array(size * size);
  const centerX = (bounds.left + bounds.right) / 2;
  for (let y = 0; y < size; y++) {
    const sourceY = Math.round(bounds.top + ((y + 0.5) / size) * bounds.height);
    for (let x = 0; x < size; x++) {
      const sourceX = Math.round(
        centerX + ((x + 0.5) / size - 0.5) * bounds.height,
      );
      if (
        sourceX >= 0 &&
        sourceX < mask.width &&
        sourceY >= 0 &&
        sourceY < mask.height &&
        mask.data[sourceY * mask.width + sourceX] >= config.maskThreshold
      )
        data[y * size + x] = 1;
    }
  }
  return {
    angleDegrees: ((angleDegrees % 360) + 360) % 360,
    width: size,
    height: size,
    data,
    quality: Math.max(0, Math.min(1, quality)),
  };
}
