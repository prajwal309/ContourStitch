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

type Prior = { timestamp: number; points: Landmark[] };

export class GuidedScan {
  private index = 0;
  private previous: Prior | null = null;
  private startedAt: number | null = null;
  private candidates: Sample[] = [];
  private views: Partial<Record<Pose, Sample[]>> = {};
  private skipped: Pose[] = [];

  constructor(
    private calibration: Calibration,
    private estimator: LiveEstimator = silhouetteEstimator,
  ) {}

  snapshot(message = 'Match the pose and hold still.', held = false) {
    const pose = poses[this.index];
    const provisional =
      pose && this.candidates.length >= c.minimumFrames
        ? this.estimator.report(
            { ...this.views, [pose.id]: this.candidates },
            this.calibration,
          )
        : null;
    return {
      index: this.index,
      skipped: [...this.skipped],
      complete: this.index === poses.length,
      message,
      held,
      provisional,
      report: this.estimator.report(this.views, this.calibration),
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

  skip() {
    const pose = poses[this.index];
    if (!pose) return this.snapshot();
    this.skipped.push(pose.id);
    return this.advance();
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
        'Move your nearer arm forward until your torso outline is clear.',
      );
    }
    if (pose.id === 'neck' && !evidence.widths.neck) {
      this.clearHold();
      return this.snapshot(
        'Keep your head upright and clear hair or clothing away from your neckline. You can skip and use a tape.',
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
    return this.snapshot('Good position. Hold still.', true);
  }
}
