import type { Landmark, VisionFrame } from '@/lib/vision/types';
import type { Calibration } from './calibration';
import { liveConfig as c } from './config';
import {
  silhouetteEstimator,
  type LiveEstimator,
  type Sample,
} from './estimator';
import {
  frameFraming,
  motionBetween,
  poseFeedback,
  poses,
  type Pose,
} from './guidance';
import { progressiveEstimates } from './progressive';

type Prior = { timestamp: number; points: Landmark[] };

export class GuidedScan {
  private index = 0;
  private previous: Prior | null = null;
  private startedAt: number | null = null;
  private candidates: Sample[] = [];
  private views: Partial<Record<Pose, Sample[]>> = {};

  constructor(
    private calibration: Calibration,
    private estimator: LiveEstimator = silhouetteEstimator,
    private priorHeightCm = calibration.heightCm,
  ) {}

  snapshot(message?: string, held = false) {
    const pose = poses[this.index];
    const complete = this.index === poses.length;
    const provisional =
      pose && this.candidates.length > 0
        ? this.estimator.report(
            { ...this.views, [pose.id]: this.candidates },
            this.calibration,
            { allowPreliminary: true },
          )
        : null;
    const report = this.estimator.report(this.views, this.calibration);
    const samples = {
      ...this.views,
      ...(pose && this.candidates.length ? { [pose.id]: this.candidates } : {}),
    };
    return {
      index: this.index,
      complete,
      message: message ?? pose?.instruction ?? 'Scan complete.',
      held,
      provisional,
      report,
      progressive: progressiveEstimates(
        this.priorHeightCm,
        provisional ?? report,
        samples,
        complete,
      ),
    };
  }

  private clearHold() {
    this.startedAt = null;
    this.candidates = [];
  }

  private advance() {
    this.index++;
    this.previous = null;
    this.clearHold();
    return this.snapshot();
  }

  update(frame: VisionFrame) {
    const pose = poses[this.index];
    if (!pose) return this.snapshot();
    const prior = this.previous;
    this.previous = { timestamp: frame.timestamp, points: frame.landmarks };
    const quality = frameFraming(frame);
    const guidance = quality.message ?? poseFeedback(frame, pose.id);
    const interrupted =
      prior &&
      (frame.timestamp <= prior.timestamp ||
        frame.timestamp - prior.timestamp > c.maxGapMs ||
        motionBetween(frame.landmarks, prior.points));
    const evidence =
      !guidance && !interrupted && quality.bounds
        ? this.estimator.sample(
            frame,
            quality.bounds,
            pose.id,
            this.calibration,
          )
        : null;

    if (!evidence) {
      this.clearHold();
      return this.snapshot(guidance ?? 'Hold still for a moment.');
    }

    if (
      pose.id === 'side' &&
      !evidence.widths.chest &&
      !evidence.widths.waist &&
      !evidence.widths.hip
    ) {
      this.clearHold();
      return this.snapshot(
        'Move your nearer arm slightly forward so your torso outline is clear.',
      );
    }
    if (pose.id === 'neck' && !evidence.widths.neck) {
      this.clearHold();
      return this.snapshot(
        'Keep your head upright and move hair or clothing clear of your neckline. If needed, enter this measurement with a tape instead.',
      );
    }

    this.startedAt ??= frame.timestamp;
    this.candidates.push(evidence);
    if (this.candidates.length > c.windowFrames) this.candidates.shift();
    if (
      this.candidates.length >= c.minimumFrames &&
      frame.timestamp - this.startedAt >= c.holdMs
    ) {
      this.views[pose.id] = this.candidates;
      return this.advance();
    }
    return this.snapshot('Perfect. Hold still.', true);
  }
}
