import {
  labels,
  liveMeasurementKeys,
  type MeasurementKey,
} from '@/lib/measurement/types';

const acquisitionMilestones = [10, 25, 50, 75, 90, 100] as const;

export function acquisitionProgress(
  estimates: readonly { key: MeasurementKey }[],
  supported: readonly MeasurementKey[] = liveMeasurementKeys,
) {
  const acquired = new Set(
    estimates.map(({ key }) => key).filter((key) => supported.includes(key)),
  );
  const count = acquired.size;
  return {
    count,
    total: supported.length,
    percent: supported.length
      ? Math.round((count / supported.length) * 100)
      : 0,
  };
}

export function reachedAcquisitionMilestones(
  previousPercent: number,
  currentPercent: number,
) {
  return acquisitionMilestones.filter(
    (milestone) => milestone > previousPercent && milestone <= currentPercent,
  );
}

function joinNames(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

export function acquisitionAnnouncement({
  view,
  newlyAcquired,
  percent,
  milestones,
  complete,
}: {
  view: string;
  newlyAcquired: readonly MeasurementKey[];
  percent: number;
  milestones: readonly number[];
  complete: boolean;
}) {
  if (complete && percent === 100)
    return 'Fantastic! All required measurements have been acquired. You are 100 percent complete. Thank you. Your measurements are ready for review.';
  if (complete)
    return 'Thank you. The scan is complete. Use a tape for any missing measurements.';

  const names = newlyAcquired.map((key) => labels[key].toLowerCase());
  const acquisition = names.length
    ? names.length === 1
      ? `Your ${names[0]} measurement has been acquired.`
      : `${joinNames(names).replace(/^./, (first) => first.toUpperCase())} measurements have been acquired.`
    : `${view} view acquired.`;
  const milestone = milestones.at(-1);
  const encouragement =
    milestone !== undefined && milestone >= 75
      ? 'Looking good.'
      : milestone !== undefined && milestone >= 25
        ? 'Great start!'
        : percent >= 75
          ? 'Almost there!'
          : percent > 0
            ? "You're doing great."
            : 'Perfect!';
  const progress = percent > 0 ? ` You're ${percent} percent complete.` : '';

  return `${encouragement} ${acquisition}${progress}`;
}
