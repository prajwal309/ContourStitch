/** Engineering gates for evidence and repeatability, without physical calibration claims. */
export const multiViewConfig = {
  inferenceIntervalMs: 340,
  keyframeIntervalMs: 440,
  fastTurnDegrees: 22,
  angleStepDegrees: 15,
  minimumFrames: 3,
  framesPerBucket: 5,
  minimumAngularSpan: 0.55,
  fitResidual: 0.1,
  repeatability: 0.12,
  minimumAnchorFraction: 0.075,
  maximumAnchorLean: 0.3,
  minimumMaskSpanFraction: 0.004,
  maximumWorkingDimensionCm: 300,
  workerTimeoutMs: 2500,
} as const;
