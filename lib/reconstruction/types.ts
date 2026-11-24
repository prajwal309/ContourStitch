import type { MeasurementEstimate } from '@/lib/measurement/types';

export type MeasurementEngineId = 'baseline' | 'parametric' | 'visual-hull';

export type EngineAvailability =
  { available: true } | { available: false; reason: string };

export type SilhouetteObservation = {
  angleDegrees: number;
  width: number;
  height: number;
  /** Binary foreground mask normalized to one body-height unit. */
  data: Uint8Array;
  quality: number;
};

export type VisualHullInput = {
  heightCm: number;
  views: SilhouetteObservation[];
};

export type ReconstructionMesh = {
  /** XYZ vertices in centimetres. */
  verticesCm: Float32Array;
  /** Triangle indices into verticesCm (three indices per face). */
  indices: Uint32Array;
};

export type VisualHullResult = {
  engine: 'visual-hull';
  estimates: MeasurementEstimate[];
  missing: string[];
  mesh: ReconstructionMesh;
  quality: {
    viewCount: number;
    meanSilhouetteQuality: number;
    grid: { x: number; y: number; z: number };
    calibrated: false;
    warnings: string[];
  };
};

export type BenchmarkCase = {
  id: string;
  engine: MeasurementEngineId;
  key: string;
  viewCount?: 4 | 8 | 16 | 32 | 64;
  predictedCm: number | null;
  referenceCm: number;
  uncertaintyCm: number | null;
  latencyMs: number | null;
  failed: boolean;
};

export type BenchmarkMetric = {
  engine: MeasurementEngineId;
  key: string;
  viewCount: 4 | 8 | 16 | 32 | 64 | null;
  sampleCount: number;
  failureRate: number;
  biasCm: number | null;
  maeCm: number | null;
  rmseCm: number | null;
  percentile95AbsoluteErrorCm: number | null;
  meanLatencyMs: number | null;
  uncertaintyCoverage: number | null;
};
