import type { VisionFrame } from '@/lib/vision/types';
import type { SilhouetteObservation } from '@/lib/reconstruction/types';
import { normalizeSilhouette } from '@/lib/reconstruction/silhouette';
import { scanConfig as c } from './config';
import { analyzeFrame, angleDelta } from './analysis';
import { extractFeatures, aggregate } from './features';
import type {
  Candidate,
  ScanSnapshot,
  ScanState,
  InstructionId,
  ScanView,
  MeasurementCalibration,
} from './types';
/** Keeps bounded features; optional mode retains only low-resolution binary masks in memory. */
export class Scanner {
  private previous: VisionFrame | null = null;
  private angle: number | null = null;
  private started: number | null = null;
  private held: number | null = null;
  private rotating = false;
  private travel = 0;
  private lastMoving: number | null = null;
  private warnings = new Set<string>();
  private readonly silhouetteViewCount: number;
  private silhouetteViews: (SilhouetteObservation | null)[];
  private views: Record<ScanView, Candidate[]> = {
    FRONT: [],
    LEFT_SIDE: [],
    BACK: [],
    RIGHT_SIDE: [],
  };
  snapshot: ScanSnapshot = {
    state: 'FIND_PERSON',
    instruction: 'FIND_PERSON',
    progress: 0,
    speed: 0,
    direction: 'still',
    analysis: null,
    result: null,
  };
  constructor(
    private calibration: MeasurementCalibration,
    options: { silhouetteViewCount?: number } = {},
  ) {
    this.silhouetteViewCount = options.silhouetteViewCount ?? 0;
    if (
      this.silhouetteViewCount !== 0 &&
      ![4, 8, 16, 32, 64].includes(this.silhouetteViewCount)
    )
      throw new Error('Silhouette view count must be 4, 8, 16, 32, or 64.');
    this.silhouetteViews = Array(this.silhouetteViewCount).fill(null);
  }
  update(frame: VisionFrame): ScanSnapshot {
    if (this.snapshot.state === 'COMPLETE' || this.snapshot.state === 'ERROR')
      return this.snapshot;
    const now = frame.timestamp;
    this.started ??= now;
    const analysis = analyzeFrame(frame, this.previous, this.angle);
    const elapsed = this.previous ? now - this.previous.timestamp : 0;
    const delta =
      analysis.angle !== null && this.angle !== null
        ? angleDelta(analysis.angle, this.angle)
        : 0;
    const speed = elapsed > 0 ? (delta / elapsed) * 1000 : 0;
    const fresh = elapsed <= c.maxFrameGapMs && elapsed >= 0;
    // Preserve only landmarks for motion estimation; discard segmentation immediately.
    this.previous = { ...frame, mask: null };
    this.angle = analysis.angle;
    const set = (state: ScanState, instruction: InstructionId) => {
      this.snapshot = {
        ...this.snapshot,
        state,
        instruction,
        analysis,
        silhouetteViewsCaptured: this.silhouetteViews.filter(Boolean).length,
        ...(this.silhouetteViewCount
          ? { silhouetteTargetViews: this.silhouetteViewCount }
          : {}),
        speed,
        direction:
          Math.abs(speed) < c.minSpeed ? 'still' : speed > 0 ? 'right' : 'left',
        progress: Math.min(99, Math.round((this.travel / 360) * 100)),
      };
      return this.snapshot;
    };
    if (now - this.started > c.timeoutMs) return set('ERROR', 'RETRY');
    if (!fresh) {
      this.held = null;
      if (this.rotating) {
        this.warnings.add(
          'Tracking was interrupted. Repeat the scan without leaving the camera view.',
        );
        return set('ERROR', 'RETRY');
      }
    }
    if (analysis.instruction) {
      this.held = null;
      this.warnings.add(
        'Body framing or pose needed adjustment during the scan.',
      );
      const state: ScanState =
        analysis.instruction === 'FIND_PERSON'
          ? 'FIND_PERSON'
          : analysis.instruction === 'SHOW_FULL_BODY'
            ? 'CHECK_FULL_BODY'
            : ['MOVE_BACK', 'MOVE_CLOSER'].includes(analysis.instruction)
              ? 'ADJUST_DISTANCE'
              : ['MOVE_LEFT', 'MOVE_RIGHT'].includes(analysis.instruction)
                ? 'CENTER_PERSON'
                : 'CHECK_POSTURE';
      return set(state, analysis.instruction);
    }
    const add = () => {
      if (
        analysis.quality < c.minimumQuality ||
        analysis.orientation === 'UNKNOWN'
      )
        return;
      const samples = this.views[analysis.orientation];
      samples.push({
        quality: analysis.quality,
        features: extractFeatures(frame),
      });
      samples.sort((a, b) => b.quality - a.quality);
      samples.splice(c.candidatesPerView);
    };
    const addSilhouette = () => {
      if (
        !this.silhouetteViewCount ||
        analysis.quality < c.minimumQuality ||
        !frame.mask
      )
        return;
      const spacing = 360 / this.silhouetteViewCount;
      const slot = Math.round(this.travel / spacing) % this.silhouetteViewCount;
      const targetAngle = slot * spacing;
      const angleError = Math.abs(
        ((this.travel - targetAngle + 540) % 360) - 180,
      );
      if (angleError > Math.max(1, Math.min(20, spacing * 0.45))) return;
      if (
        this.silhouetteViews[slot] &&
        this.silhouetteViews[slot].quality >= analysis.quality
      )
        return;
      this.silhouetteViews[slot] = normalizeSilhouette(
        frame,
        this.travel,
        analysis.quality,
      );
    };
    if (!this.rotating) {
      if (analysis.orientation !== 'FRONT') {
        this.held = null;
        return set('FRONT_CAPTURE', 'FACE_FRONT');
      }
      if (
        analysis.motionScore > c.maxMotion ||
        analysis.quality < c.minimumQuality
      ) {
        this.held = null;
        return set('FRONT_CAPTURE', 'HOLD_STILL');
      }
      this.held ??= now;
      add();
      addSilhouette();
      if (
        now - this.held < c.holdMs ||
        this.views.FRONT.length < c.minimumCandidates
      )
        return set('FRONT_CAPTURE', 'HOLD_STILL');
      this.rotating = true;
      this.travel = 0;
      this.lastMoving = now;
      return set('START_ROTATION', 'START_TURNING');
    }
    if (Math.abs(delta) > c.maxJump || Math.abs(speed) > c.maxSpeed) {
      this.warnings.add('You turned too quickly during part of the scan.');
      return set('ROTATING', 'TURN_SLOWER');
    }
    if (delta < -1) {
      this.warnings.add('Turning direction reversed during the scan.');
      return set('ROTATING', 'KEEP_TURNING');
    }
    if (delta > 0) {
      this.travel += delta;
      if (speed >= c.minSpeed) this.lastMoving = now;
    }
    addSilhouette();
    // Require views in sequence; a noisy jump cannot manufacture full coverage.
    const next: ScanView =
      this.views.LEFT_SIDE.length < c.minimumCandidates
        ? 'LEFT_SIDE'
        : this.views.BACK.length < c.minimumCandidates
          ? 'BACK'
          : this.views.RIGHT_SIDE.length < c.minimumCandidates
            ? 'RIGHT_SIDE'
            : 'FRONT';
    if (analysis.orientation === next) add();
    if (this.travel >= 335 && analysis.orientation === 'FRONT') {
      if (
        Object.values(this.views).some(
          (samples) => samples.length < c.minimumCandidates,
        )
      )
        return set('QUALITY_CHECK', 'RETRY');
      const result = aggregate(this.calibration.heightCm, this.views, [
        ...this.warnings,
      ]);
      const silhouettes = this.silhouetteViews.filter(
        (view): view is SilhouetteObservation => view !== null,
      );
      if (
        this.silhouetteViewCount &&
        silhouettes.length < this.silhouetteViewCount
      )
        result.quality.warnings.push(
          `Only ${silhouettes.length} of ${this.silhouetteViewCount} requested silhouette angles passed capture quality checks.`,
        );
      if (silhouettes.length) {
        result.silhouetteViews = silhouettes;
        result.silhouetteCoveragePercent = Math.round(
          (silhouettes.length / this.silhouetteViewCount) * 100,
        );
      }
      set('COMPLETE', 'SCAN_COMPLETE');
      this.snapshot = { ...this.snapshot, progress: 100, result };
      this.previous = null;
      return this.snapshot;
    }
    return set(
      'ROTATING',
      this.travel > 290
        ? 'RETURN_TO_FRONT'
        : now - (this.lastMoving ?? now) > 3000
          ? 'TURN_FASTER'
          : 'KEEP_TURNING',
    );
  }
}
