import { createVisionEngine } from '@/lib/vision/pose';
import type { VisionEngine, VisionFrame } from '@/lib/vision/types';
/** Explicit local-development injection only, so CI needs no physical camera. */
export async function createScannerVisionEngine(): Promise<VisionEngine> {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_SCANNER_TEST_MODE === '1'
  ) {
    const injected = (
      window as Window & { __scanTestFrame?: () => VisionFrame }
    ).__scanTestFrame;
    if (injected)
      return {
        async infer() {
          return injected();
        },
        close() {},
      };
  }
  return createVisionEngine();
}
