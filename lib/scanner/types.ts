import type { VisionFrame } from '@/lib/vision/types';
import type { SilhouetteObservation } from '@/lib/reconstruction/types';
export type ScanState =
  | 'FIND_PERSON'
  | 'CHECK_FULL_BODY'
  | 'ADJUST_DISTANCE'
  | 'CENTER_PERSON'
  | 'CHECK_POSTURE'
  | 'FRONT_CAPTURE'
  | 'START_ROTATION'
  | 'ROTATING'
  | 'QUALITY_CHECK'
  | 'COMPLETE'
  | 'ERROR';
export type InstructionId =
  | 'FIND_PERSON'
  | 'SHOW_FULL_BODY'
  | 'MOVE_CLOSER'
  | 'MOVE_BACK'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'STAND_STRAIGHT'
  | 'ARMS_OUT'
  | 'HOLD_STILL'
  | 'FACE_FRONT'
  | 'START_TURNING'
  | 'KEEP_TURNING'
  | 'TURN_SLOWER'
  | 'TURN_FASTER'
  | 'RETURN_TO_FRONT'
  | 'IMPROVE_LIGHT'
  | 'SCAN_COMPLETE'
  | 'RETRY';
export type BodyOrientation =
  'FRONT' | 'LEFT_SIDE' | 'BACK' | 'RIGHT_SIDE' | 'UNKNOWN';
export type ScanView = Exclude<BodyOrientation, 'UNKNOWN'>;
export type MeasurementCalibration = { type: 'KNOWN_HEIGHT'; heightCm: number };
export type FrameAnalysis = {
  timestamp: number;
  orientation: BodyOrientation;
  angle: number | null;
  orientationScore: number;
  framingScore: number;
  poseConfidence: number;
  motionScore: number;
  quality: number;
  instruction: InstructionId | null;
  bounds: { left: number; right: number; top: number; bottom: number } | null;
};
export const featureNames = [
  'heightCm',
  'shoulderWidthRatio',
  'chestFrontRatio',
  'chestSideRatio',
  'waistFrontRatio',
  'waistSideRatio',
  'hipFrontRatio',
  'hipSideRatio',
  'torsoLengthRatio',
  'legLengthRatio',
  'armLengthRatio',
  'scanQuality',
] as const;
export type FeatureName = (typeof featureNames)[number];
export type BodyScanFeatures = Record<FeatureName, number | null>;
export type FrameFeatures = {
  shoulder: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  torso: number | null;
  leg: number | null;
  arm: number | null;
};
export type Candidate = { quality: number; features: FrameFeatures };
export type ScanQuality = {
  overall: number;
  warnings: string[];
  frontQuality: number;
  leftQuality: number;
  backQuality: number;
  rightQuality: number;
};
export type ScanResult = {
  features: BodyScanFeatures;
  quality: ScanQuality;
  /** Optional, low-resolution binary masks held only in this scan's memory. */
  silhouetteViews?: SilhouetteObservation[];
  silhouetteCoveragePercent?: number;
};
export type ScanSnapshot = {
  state: ScanState;
  instruction: InstructionId;
  progress: number;
  silhouetteViewsCaptured?: number;
  silhouetteTargetViews?: number;
  speed: number;
  direction: 'right' | 'left' | 'still';
  analysis: FrameAnalysis | null;
  result: ScanResult | null;
};
export type AnalyzeFrame = (
  frame: VisionFrame,
  previous: VisionFrame | null,
  previousAngle: number | null,
) => FrameAnalysis;
