import { config } from '@/lib/measurement/config';
import { imageQuality } from './quality';
import type { VisionEngine, VisionFrame } from './types';

async function createDetector(mode: 'VIDEO' | 'IMAGE') {
  // https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
  const { FilesetResolver, PoseLandmarker } =
    await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks('/models/wasm');
  const task = await PoseLandmarker.createFromOptions(files, {
    baseOptions: {
      modelAssetPath: '/models/pose_landmarker_full.task',
      delegate: 'CPU',
    },
    runningMode: mode,
    numPoses: 2,
    outputSegmentationMasks: true,
    minPoseDetectionConfidence: config.minVisibility,
    minPosePresenceConfidence: config.minVisibility,
    minTrackingConfidence: config.minVisibility,
  });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    task.close();
    throw new Error('Canvas unavailable');
  }

  let closed = false;
  return {
    infer(
      image: HTMLVideoElement | HTMLImageElement,
      sourceWidth: number,
      sourceHeight: number,
    ): VisionFrame {
      if (closed) throw new Error('Vision closed');

      const width = Math.min(config.maxInferenceWidth, sourceWidth);
      const height = Math.max(
        1,
        Math.round((sourceHeight * width) / sourceWidth),
      );
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      const timestamp = performance.now();
      const result =
        mode === 'VIDEO'
          ? task.detectForVideo(canvas, timestamp)
          : task.detect(canvas);
      try {
        const mask = result.segmentationMasks?.[0];
        return {
          width,
          height,
          timestamp,
          poseCount: result.landmarks.length,
          landmarks: (result.landmarks[0] ?? []).map(
            ({ x, y, z, visibility }) => ({
              x,
              y,
              z,
              visibility: visibility ?? 0,
            }),
          ),
          mask: mask
            ? {
                width: mask.width,
                height: mask.height,
                data: new Float32Array(mask.getAsFloat32Array()),
              }
            : null,
          ...imageQuality(
            context.getImageData(0, 0, width, height).data,
            width,
            height,
          ),
        };
      } finally {
        result.close();
      }
    },
    close() {
      if (closed) return;
      closed = true;
      task.close();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

export async function createVisionEngine(): Promise<VisionEngine> {
  const detector = await createDetector('VIDEO');
  return {
    async infer(video) {
      return detector.infer(video, video.videoWidth, video.videoHeight);
    },
    close: detector.close,
  };
}

export async function inferPhoto(
  file: File,
  signal: AbortSignal,
): Promise<VisionFrame> {
  const url = URL.createObjectURL(file);
  const photo = new Image();
  const discard = () => photo.removeAttribute('src');
  signal.addEventListener('abort', discard, { once: true });
  try {
    signal.throwIfAborted();
    photo.src = url;
    await photo.decode();
    signal.throwIfAborted();
    const detector = await createDetector('IMAGE');
    try {
      signal.throwIfAborted();
      return detector.infer(photo, photo.naturalWidth, photo.naturalHeight);
    } finally {
      detector.close();
    }
  } finally {
    signal.removeEventListener('abort', discard);
    discard();
    URL.revokeObjectURL(url);
  }
}
