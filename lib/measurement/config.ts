/** Unvalidated engineering heuristics, centralized for representative dataset calibration.
 * Landmark indices follow https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 * These sampling fractions are NOT standardized anatomical tape locations.
 */
export const config = {
  minVisibility:0.65, maskThreshold:0.55, maskUncertainLow:0.25, maskUncertainHigh:0.75,
  frameMargin:0.025, minBodyHeight:0.6, maxBodyHeight:0.94,
  maxTiltDegrees:6, frontShoulderRatio:0.2, sideShoulderRatio:0.14,
  minArmAngle:15, maxArmAngle:25, minFeetRatio:0.06, maxFeetRatio:0.28,
  minBrightness:45, minSharpness:25, maxMaskInstability:0.18,
  sampleFractions:{chest:0.3,waist:0.72,hip:1}, sampleRadius:3, minSampleRows:3,
  maxScaleDifference:0.12, inferenceIntervalMs:400, maxInferenceWidth:640,
  baseUncertainty:{height:1,shoulder:3,chest:6,waist:7,hip:6,sleeve:4,inseam:8,outseam:5},
  qualityPenalty:0.3, overridePenalty:0.65, scalePenalty:2, instabilityPenalty:2,
  maxFrameAgeMs:1600, crotchSearchFraction:0.3,
} as const;
