import { liveConfig } from '../config';
import type { Pose } from '../guidance';
import { angularCoefficient } from './fusion';
import type { FrameObservation, Path, Section } from './observe';

export type EvidenceKey = Section | Path;
export type EvidenceStatus = {
  key: EvidenceKey;
  acquired: boolean;
  visible: boolean;
  metric: boolean;
  informativeFrames: number;
  angleBuckets: number;
  coverage: number;
  angularDiversity: number;
  repeatability: number | null;
  /** Current observations exist in normalized coordinates. */
  observed: boolean;
};

type Candidate = {
  target: Pose;
  message: string;
  gain: number;
};

export function planNextObservation(
  observation: FrameObservation,
  evidence: readonly EvidenceStatus[],
  sectionAngles: Readonly<
    Partial<Record<Section, { front: number; side: number }>>
  >,
  calibrated: boolean,
): Omit<Candidate, 'gain'> {
  const { yaw, message } = observation;
  if (message) return { target: 'front', message };
  if (yaw === null && observation.timestamp < 0)
    return { target: 'front', message: 'Measurement acquisition started.' };
  if (
    !calibrated ||
    evidence.some(
      ({ key, observed, metric }) =>
        observed && !metric && (key === 'shoulder' || key === 'outseam'),
    )
  )
    return {
      target: 'front',
      message:
        'Your outline is being collected. Step back until your head and feet are visible briefly to set the scale.',
    };

  const pending = evidence.filter(({ acquired }) => !acquired);
  const key = (name: EvidenceKey) => pending.find((item) => item.key === name);
  const candidates: Candidate[] = [];
  const facing = yaw === null ? 0.5 : angularCoefficient(yaw);
  const frontGain = Object.values(sectionAngles).reduce(
    (gain, view) => gain + view.side * (1 - view.front),
    0,
  );
  const sideGain = Object.values(sectionAngles).reduce(
    (gain, view) => gain + view.front * (1 - view.side),
    0,
  );
  if (frontGain > 0)
    candidates.push({
      target: 'front',
      gain: frontGain + facing * 0.1,
      message: 'Face the camera and hold for a moment.',
    });
  if (sideGain > 0)
    candidates.push({
      target: 'side',
      gain: sideGain + (1 - facing) * 0.1,
      message:
        facing < 0.2
          ? 'Hold this side view. Move your nearer arm slightly forward if it covers your torso.'
          : 'Turn slowly until your side faces the camera.',
    });
  const upper = ['shoulder', 'sleeve', 'chest', 'waist', 'neck'] as const;
  const unseenUpper = upper.filter((name) => key(name) && !key(name)?.observed);
  if (unseenUpper.length)
    candidates.push({
      target: 'front',
      gain: 0.6 + 0.18 * unseenUpper.length,
      message:
        unseenUpper.includes('neck') && unseenUpper.length === 1
          ? 'Keep your head upright and move hair or clothing away from your neck.'
          : 'Face the camera with your upper body in view. Keep your arms slightly away from your torso.',
    });
  if (key('arm'))
    candidates.push({
      target: 'extended',
      gain: 0.75 + (key('arm')?.visible ? 0.4 : 0),
      message:
        'Face the camera. Extend both arms to your sides and hold briefly.',
    });
  if (key('outseam') || (key('hip') && !key('hip')?.observed))
    candidates.push({
      target: 'front',
      gain: key('outseam')?.visible ? 1.25 : 0.7,
      message:
        'Bring your hips and legs into view. Stand with your legs straight.',
    });

  const chosen = candidates.sort((a, b) => b.gain - a.gain)[0];
  if (chosen) return chosen;
  return {
    target: 'front',
    message:
      yaw !== null && Math.abs(yaw) > liveConfig.viewToleranceDegrees
        ? 'Turn slowly toward the camera and pause to refine the remaining estimates.'
        : 'Hold briefly to refine the remaining estimates, or review your measurements.',
  };
}
