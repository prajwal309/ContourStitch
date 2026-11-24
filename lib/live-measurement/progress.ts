import { tapeMethod } from '@/lib/measurement/corrections';
import type { MeasurementEstimate } from '@/lib/measurement/types';
import { liveMeasurementKeys } from '@/lib/measurement/types';
import { poses, type Pose } from './guidance';

export type LiveMeasurementKey = (typeof liveMeasurementKeys)[number];
export type MeasurementProgressState =
  | 'unavailable'
  | 'collecting'
  | 'preliminary'
  | 'refined'
  | 'ready'
  | 'corrected';

export type MeasurementProgress = {
  state: MeasurementProgressState;
  label: string;
  detail: string;
};

export const measurementDependencies: Record<
  LiveMeasurementKey,
  {
    requiredViews: readonly Pose[];
    optionalViews: readonly Pose[];
    evidence: string;
  }
> = {
  shoulder: {
    requiredViews: ['front'],
    optionalViews: [],
    evidence:
      'Shoulder-joint landmarks and entered height or a known-size reference for scale.',
  },
  arm: {
    requiredViews: ['extended'],
    optionalViews: [],
    evidence:
      'Both shoulder and wrist landmarks in the arms-extended pose, plus scale calibration.',
  },
  chest: {
    requiredViews: ['front', 'side'],
    optionalViews: ['back'],
    evidence:
      'Stable front width and side depth, matching scales, person segmentation, torso landmarks, and calibration. The back view can corroborate width.',
  },
  sleeve: {
    requiredViews: ['front'],
    optionalViews: ['back'],
    evidence:
      'Shoulder, elbow, and wrist landmarks with scale calibration. The back view can refine the estimate.',
  },
  neck: {
    requiredViews: ['side', 'neck'],
    optionalViews: [],
    evidence:
      'Clear neck silhouettes from the side and relaxed-neck views with consistent scale.',
  },
  waist: {
    requiredViews: ['front', 'side'],
    optionalViews: ['back'],
    evidence:
      'Stable front width and side depth, matching scales, person segmentation, torso landmarks, and calibration. The back view can corroborate width.',
  },
  hip: {
    requiredViews: ['front', 'side'],
    optionalViews: ['back'],
    evidence:
      'Stable front width and side depth, matching scales, person segmentation, torso landmarks, and calibration. The back view can corroborate width.',
  },
};

const viewLabel = (view: Pose) =>
  poses.find(({ id }) => id === view)?.label.toLowerCase() ?? view;

export function measurementProgress(
  key: LiveMeasurementKey,
  context: {
    estimate?: MeasurementEstimate;
    reviewedEstimate?: MeasurementEstimate;
    pose?: Pose;
    completedViews: readonly Pose[];
    captureActive: boolean;
    missing?: string;
  },
): MeasurementProgress {
  const { requiredViews, optionalViews } = measurementDependencies[key];
  const estimate = context.estimate;
  const reviewedEstimate = context.reviewedEstimate;

  if (estimate?.method === tapeMethod) {
    return {
      state: 'corrected',
      label: 'Manually corrected',
      detail:
        'Your tape entry is shown; the original estimate remains in review history.',
    };
  }

  const activeView =
    context.captureActive &&
    context.pose &&
    [...requiredViews, ...optionalViews].includes(context.pose);
  if (activeView && context.pose) {
    if (estimate) {
      return reviewedEstimate
        ? {
            state: 'refined',
            label: 'Refined estimate',
            detail: 'Updated with additional repeatable view evidence.',
          }
        : {
            state: 'preliminary',
            label: 'Preliminary estimate',
            detail:
              'A supported estimate is forming; it may change with more evidence.',
          };
    }

    const stillNeeded = requiredViews.filter(
      (view) => view !== context.pose && !context.completedViews.includes(view),
    );
    return {
      state: 'collecting',
      label: 'Collecting data',
      detail: stillNeeded.length
        ? `Hold this pose; also needs ${stillNeeded.map(viewLabel).join(' and ')} view${stillNeeded.length > 1 ? 's' : ''}.`
        : `Hold the ${viewLabel(context.pose)} pose for repeatable samples.`,
    };
  }

  if (reviewedEstimate) {
    return {
      state: 'ready',
      label: 'Ready for review',
      detail: 'Confirm this experimental estimate with a tape.',
    };
  }

  const missingViews = requiredViews.filter(
    (view) => !context.completedViews.includes(view),
  );
  if (missingViews.length) {
    return {
      state: 'unavailable',
      label: 'Not available',
      detail: `Needs ${missingViews.map(viewLabel).join(' and ')} view${missingViews.length > 1 ? 's' : ''}.`,
    };
  }

  return {
    state: 'unavailable',
    label: 'Not available',
    detail:
      context.missing ??
      'Required views were collected, but the needed landmarks or silhouette did not pass quality checks.',
  };
}
