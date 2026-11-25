import { liveConfig } from './config';
import {
  anthropometricPrior,
  progressiveMeasurementKeys,
  type ProgressiveMeasurementKey,
} from './anthropometric-priors';
import type { Pose } from './guidance';
import type { Sample } from './estimator';
import type { MeasurementEstimate, MeasurementReport } from '@/lib/measurement/types';
import { ellipseCircumference } from '@/lib/measurement/circumference';
import { median } from '@/lib/measurement/silhouette';

export { progressiveMeasurementKeys };
export type { ProgressiveMeasurementKey };

export type ProgressiveSource =
  | 'prior'
  | 'blended'
  | 'camera'
  | 'unavailable';

export type ProgressiveEstimate = {
  key: ProgressiveMeasurementKey;
  valueCm: number | null;
  rangeHalfWidthCm: number | null;
  priorValueCm?: number;
  cameraValueCm?: number;
  source: ProgressiveSource;
  quality: number;
  viewCoverage: number;
  observedViews: number;
  requiredViews: number;
  sampleCount: number;
};

export const measurementDependencies: Record<
  ProgressiveMeasurementKey,
  {
    requiredViews: readonly Pose[];
    optionalViews: readonly Pose[];
    evidence: string;
  }
> = {
  shoulder: {
    requiredViews: ['front'],
    optionalViews: [],
    evidence: 'Shoulder landmarks from a clear front view.',
  },
  arm: {
    requiredViews: ['extended'],
    optionalViews: [],
    evidence: 'Shoulder, elbow, and wrist landmarks in the arms-extended view.',
  },
  chest: {
    requiredViews: ['front', 'side'],
    optionalViews: ['back'],
    evidence: 'Repeatable front width and side depth from matching scales.',
  },
  waist: {
    requiredViews: ['front', 'side'],
    optionalViews: ['back'],
    evidence: 'Repeatable front width and side depth from matching scales.',
  },
  hip: {
    requiredViews: ['front', 'side'],
    optionalViews: ['back'],
    evidence: 'Repeatable front width and side depth from matching scales.',
  },
  inseam: {
    requiredViews: [],
    optionalViews: [],
    evidence: 'This build has no supported camera method for inseam.',
  },
  torso: {
    requiredViews: ['front'],
    optionalViews: ['back'],
    evidence: 'Vertical shoulder-to-hip landmark distance in front/back views.',
  },
  neck: {
    requiredViews: ['side', 'neck'],
    optionalViews: [],
    evidence: 'Neck silhouettes from the side and relaxed-neck views.',
  },
  sleeve: {
    requiredViews: ['front'],
    optionalViews: ['back'],
    evidence: 'Shoulder, elbow, and wrist landmarks from front/back views.',
  },
};

type SamplesByPose = Partial<Record<Pose, readonly Sample[]>>;

function averageSides(sample: Sample) {
  return sample.arms
    ? (sample.arms.left + sample.arms.right) / 2
    : undefined;
}

function validValues(values: (number | null | undefined)[]) {
  return values.filter(
    (value): value is number =>
      value !== null &&
      value !== undefined &&
      Number.isFinite(value) &&
      value > 0,
  );
}

function measurementValues(
  key: ProgressiveMeasurementKey,
  samples: SamplesByPose,
) {
  if (key === 'shoulder')
    return validValues((samples.front ?? []).map((sample) => sample.shoulder));
  if (key === 'arm')
    return validValues((samples.extended ?? []).map(averageSides));
  if (key === 'sleeve')
    return validValues((samples.front ?? []).map(averageSides));
  if (key === 'torso')
    return validValues(
      [...(samples.front ?? []), ...(samples.back ?? [])].map(
        (sample) => sample.torsoCm,
      ),
    );
  if (key === 'inseam') return [];

  const frontPose = key === 'neck' ? 'neck' : 'front';
  const depthPose = key === 'neck' ? 'side' : 'side';
  const frontWidths = validValues([
    ...(samples[frontPose] ?? []).map((sample) => sample.widths[key]),
    ...(key !== 'neck'
      ? (samples.back ?? []).map((sample) => sample.widths[key])
      : []),
  ]);
  const depths = validValues(
    (samples[depthPose] ?? []).map((sample) => sample.widths[key]),
  );
  return validValues(
    frontWidths.flatMap((front) =>
      depths.map((depth) => ellipseCircumference(front, depth)),
    ),
  );
}

function relevantSamples(
  key: ProgressiveMeasurementKey,
  samples: SamplesByPose,
) {
  const { requiredViews, optionalViews } = measurementDependencies[key];
  return [...requiredViews, ...optionalViews].flatMap((pose) =>
    (samples[pose] ?? []).filter((sample) => {
      if (key === 'shoulder') return sample.shoulder !== undefined;
      if (key === 'arm') return sample.arms !== undefined && pose === 'extended';
      if (key === 'sleeve')
        return sample.arms !== undefined && (pose === 'front' || pose === 'back');
      if (key === 'torso') return sample.torsoCm !== undefined;
      if (key === 'inseam') return false;
      return sample.widths[key] !== undefined;
    }),
  );
}

function coverageFor(key: ProgressiveMeasurementKey, samples: SamplesByPose) {
  const { requiredViews } = measurementDependencies[key];
  if (!requiredViews.length) return 0;
  const coverage = requiredViews.map((pose) =>
    Math.min(
      1,
      relevantSamples(key, { [pose]: samples[pose] }).length /
        liveConfig.minimumFrames,
    ),
  );
  return coverage.reduce((sum, value) => sum + value, 0) / coverage.length;
}

function cameraEstimateFor(
  key: ProgressiveMeasurementKey,
  report: MeasurementReport,
  samples: SamplesByPose,
): Pick<MeasurementEstimate, 'valueCm'> | undefined {
  if (key === 'torso') {
    const values = measurementValues(key, samples);
    const valueCm = median(values);
    return valueCm === null
      ? undefined
      : { valueCm };
  }
  const estimate = report.estimates.find((item) => item.key === key);
  return estimate ? { valueCm: estimate.valueCm } : undefined;
}

function sampleDeviation(values: readonly number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (values.length - 1),
  );
}

export function progressiveEstimates(
  heightCm: number,
  report: MeasurementReport,
  samples: SamplesByPose,
  scanComplete = false,
): ProgressiveEstimate[] {
  return progressiveMeasurementKeys.map((key) => {
    const prior = anthropometricPrior(key, heightCm);
    const cameraEstimate = cameraEstimateFor(key, report, samples);
    const cameraValueCm = cameraEstimate?.valueCm;
    const values = measurementValues(key, samples);
    const evidence = relevantSamples(key, samples);
    const quality = evidence.length
      ? evidence.reduce(
          (sum, sample) =>
            sum +
            (sample.quality?.score ??
              liveConfig.progressive.missingSampleQuality),
          0,
        ) / evidence.length
      : 0;
    const viewCoverage = coverageFor(key, samples);
    const weight =
      cameraEstimate && prior
        ? scanComplete
          ? 1
          : Math.min(
              liveConfig.progressive.cameraWeightCap,
              quality * viewCoverage,
            )
        : cameraEstimate
          ? 1
          : 0;
    const valueCm =
      cameraValueCm === undefined
        ? (prior?.valueCm ?? null)
        : prior
          ? prior.valueCm * (1 - weight) + cameraValueCm * weight
          : cameraValueCm;

    let rangeHalfWidthCm: number | null = null;
    if (prior) {
      const cameraSigma = Math.max(
        sampleDeviation(values) / Math.sqrt(Math.max(1, values.length)),
        prior.standardDeviationCm *
          (1 - quality * (1 - liveConfig.progressive.cameraUncertaintyFloor)),
      );
      const disagreement =
        cameraValueCm === undefined
          ? 0
          : (cameraValueCm - prior.valueCm) *
            weight *
            quality *
            liveConfig.progressive.contradictionScale;
      const variance =
        prior.standardDeviationCm ** 2 * (1 - weight) +
        cameraSigma ** 2 * weight +
        disagreement ** 2;
      rangeHalfWidthCm = 1.96 * Math.sqrt(variance);
    } else if (values.length > 1) {
      rangeHalfWidthCm =
        1.96 * sampleDeviation(values) / Math.sqrt(values.length);
    }

    return {
      key,
      valueCm,
      rangeHalfWidthCm,
      ...(prior && { priorValueCm: prior.valueCm }),
      ...(cameraValueCm !== undefined && { cameraValueCm }),
      source:
        cameraValueCm === undefined
          ? prior
            ? 'prior'
            : 'unavailable'
          : prior && weight < 1
            ? 'blended'
            : 'camera',
      quality,
      viewCoverage,
      observedViews: measurementDependencies[key].requiredViews.filter(
        (pose) => relevantSamples(key, { [pose]: samples[pose] }).length > 0,
      ).length,
      requiredViews: measurementDependencies[key].requiredViews.length,
      sampleCount: evidence.length,
    };
  });
}
