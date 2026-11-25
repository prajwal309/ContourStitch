import { poses, type Pose } from './guidance';
import {
  measurementDependencies,
  type ProgressiveEstimate,
  type ProgressiveMeasurementKey,
} from './progressive';

export type MeasurementProgressState =
  | 'prior'
  | 'observing'
  | 'refining'
  | 'complete'
  | 'unavailable';

export type MeasurementProgress = {
  state: MeasurementProgressState;
  label: string;
  detail: string;
};

const viewLabel = (view: Pose) =>
  poses.find(({ id }) => id === view)?.label.toLowerCase() ?? view;

const priorConvention: Record<ProgressiveMeasurementKey, string> = {
  shoulder: 'biacromial breadth',
  arm: 'shoulder and forearm segment lengths',
  chest: 'chest circumference',
  waist: 'waist circumference',
  hip: 'buttock circumference as a hip proxy',
  inseam: 'crotch height as an inseam proxy',
  torso: 'acromial-to-iliocristale vertical distance',
  neck: 'neck circumference',
  sleeve: 'arm-length segments as a sleeve-length proxy',
};

export function measurementProgress(
  key: ProgressiveMeasurementKey,
  estimate: ProgressiveEstimate,
  context: {
    pose?: Pose;
    completedViews: readonly Pose[];
    captureActive: boolean;
    scanComplete: boolean;
  },
): MeasurementProgress {
  if (context.scanComplete) {
    return {
      state: 'complete',
      label: 'Scan Complete',
      detail:
        estimate.cameraValueCm !== undefined
          ? 'Camera observations are complete. Confirm this experimental estimate with a tape.'
          : estimate.priorValueCm !== undefined
            ? 'No supported camera estimate was available; the height-conditioned prior remains. Confirm it with a tape.'
            : 'No supported estimate is available. Enter this measurement manually.',
    };
  }

  if (estimate.source === 'unavailable') {
    return {
      state: 'unavailable',
      label: 'Estimating…',
      detail:
        'No height-conditioned prior is available for this height range, and camera evidence is not sufficient yet.',
    };
  }

  if (
    estimate.cameraValueCm !== undefined &&
    estimate.viewCoverage >= 1
  ) {
    return {
      state: 'refining',
      label: 'Refining',
      detail:
        'Updating the estimate with camera observations as repeatable frames and views arrive.',
    };
  }

  if (estimate.cameraValueCm !== undefined) {
    return {
        state: 'observing',
        label: 'Observing',
        detail: `Camera evidence is available in ${estimate.sampleCount} valid frame${estimate.sampleCount === 1 ? '' : 's'}; collecting the remaining repeatable samples.`,
    };
  }

  const { requiredViews, evidence } = measurementDependencies[key];
  const observed = requiredViews.filter(
    (view) =>
      context.completedViews.includes(view) ||
      (context.captureActive &&
        context.pose === view &&
        estimate.sampleCount > 0),
  );
  if (observed.length) {
    const remaining = requiredViews.filter(
      (view) => !observed.includes(view),
    );
    return {
      state: 'observing',
      label: 'Observing',
      detail: remaining.length
        ? `Camera evidence is building; still needs ${remaining.map(viewLabel).join(' and ')} view${remaining.length > 1 ? 's' : ''}.`
        : evidence,
    };
  }

  return {
    state: 'prior',
    label: 'Prior Estimate',
    detail:
      estimate.source === 'prior'
        ? `Height-conditioned ${priorConvention[key]} reference only; it is not an observation of your body.`
        : evidence,
  };
}
