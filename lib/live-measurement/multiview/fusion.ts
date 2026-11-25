import { median } from '@/lib/measurement/silhouette';
import { liveConfig } from '../config';
import { multiViewConfig as c } from './config';

type Reading = {
  timestamp: number;
  values: readonly number[];
  quality: number;
};
type AngularReading = Reading & { offset: number };

export type ViewEvidence = {
  angle: number;
  values: number[];
  count: number;
  quality: number;
  spread: number;
  recentCount?: number;
  recentSpread?: number;
};

/** Separate angular recurrence from repeated frames of the same pose. */
export class Keyframes {
  private readonly buckets = new Map<number, AngularReading[]>();
  private readonly recent = new Map<number, Reading[]>();
  private summaryCache: ViewEvidence[] | null = null;

  add(angle: number, reading: Reading) {
    const bin =
      ((((Math.round(angle / c.angleStepDegrees) * c.angleStepDegrees + 180) %
        360) +
        360) %
        360) -
      180;
    const history = this.recent.get(bin) ?? [];
    const previous = history.at(-1);
    const gap = previous ? reading.timestamp - previous.timestamp : Infinity;
    if (gap >= c.keyframeIntervalMs) {
      const consecutive = gap <= liveConfig.maxGapMs ? history : [];
      this.recent.set(
        bin,
        [...consecutive, reading].slice(
          -liveConfig.precision.stableObservations,
        ),
      );
      this.summaryCache = null;
    }
    const frames = this.buckets.get(bin) ?? [];
    const newest = frames.at(-1);
    if (newest && reading.timestamp - newest.timestamp < c.keyframeIntervalMs)
      return false;
    const lowestQuality = frames.reduce(
      (lowest, frame, index) =>
        frame.quality < frames[lowest].quality ? index : lowest,
      0,
    );
    if (frames.length === c.framesPerBucket) {
      if (reading.quality <= frames[lowestQuality].quality) return false;
      frames.splice(lowestQuality, 1);
    }
    const offset = ((angle - bin + 540) % 360) - 180;
    frames.push({ ...reading, offset });
    this.buckets.set(bin, frames);
    this.summaryCache = null;
    return true;
  }

  summarize(): ViewEvidence[] {
    return (this.summaryCache ??= [...this.buckets.entries()].map(
      ([angle, readings]) => {
        const values = readings[0].values.map((_, index) =>
          median(readings.map((sample) => sample.values[index]))!,
        );
        const spread = Math.max(
          ...values.map((middle, index) => {
            const deviations = readings.map((sample) =>
              Math.abs(sample.values[index] - middle),
            );
            return (
              (readings.length < c.minimumFrames
                ? Math.max(...deviations)
                : (median(deviations)! + Math.max(...deviations)) / 2) / middle
            );
          }),
        );
        const recent = this.recent.get(angle) ?? [];
        const recentSpread = Math.max(
          0,
          ...recent.flatMap(({ values: latest }) =>
            latest.map(
              (value, index) => Math.abs(value - values[index]) / values[index],
            ),
          ),
        );
        return {
          recentCount: recent.length,
          recentSpread,
          angle: angle + median(readings.map(({ offset }) => offset))!,
          values,
          count: readings.length,
          quality: median(readings.map((sample) => sample.quality))!,
          spread,
        };
      },
    ));
  }
}

export function angularCoefficient(angle: number) {
  return Math.cos((angle * Math.PI) / 180) ** 2;
}

function solve(
  observations: readonly ViewEvidence[],
  weights: readonly number[],
) {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  let xw = 0;
  let yw = 0;
  for (const [index, view] of observations.entries()) {
    const x = angularCoefficient(view.angle);
    const y = 1 - x;
    const w = weights[index];
    const squaredWidth = view.values[0] ** 2;
    xx += w * x * x;
    xy += w * x * y;
    yy += w * y * y;
    xw += w * x * squaredWidth;
    yw += w * y * squaredWidth;
  }
  const determinant = xx * yy - xy * xy;
  if (determinant < 1e-6) return null;
  const a2 = (yy * xw - xy * yw) / determinant;
  const b2 = (xx * yw - xy * xw) / determinant;
  return a2 > 0 && b2 > 0 ? ([a2, b2] as const) : null;
}

function residual(view: ViewEvidence, axes: readonly [number, number]) {
  const x = angularCoefficient(view.angle);
  const projected = Math.sqrt(x * axes[0] + (1 - x) * axes[1]);
  return Math.abs(projected - view.values[0]) / view.values[0];
}

function angularSpan(views: readonly ViewEvidence[]) {
  if (!views.length) return 0;
  const weights = views.map(({ angle }) => angularCoefficient(angle));
  return Math.max(...weights) - Math.min(...weights);
}

/** Robust width-space consensus followed by a quality-weighted squared-width fit. */
export function fitSection(input: readonly ViewEvidence[]) {
  let consensus: ViewEvidence[] = [];
  let bestScore = 0;
  for (const [i, a] of input.entries()) {
    for (const b of input.slice(i + 1)) {
      if (angularSpan([a, b]) < c.minimumAngularSpan) continue;
      const candidate = solve([a, b], [1, 1]);
      if (!candidate) continue;
      const inliers = input.filter(
        (view) => residual(view, candidate) <= c.fitResidual,
      );
      const score = inliers.reduce(
        (total, view) =>
          total +
          view.quality *
            Math.min(1, view.count / c.minimumFrames) *
            (1 - residual(view, candidate) ** 2 / c.fitResidual ** 2),
        0,
      );
      if (score > bestScore && angularSpan(inliers) >= c.minimumAngularSpan) {
        consensus = inliers;
        bestScore = score;
      }
    }
  }
  const final = solve(
    consensus,
    consensus.map((view) => view.quality),
  );
  if (!final || consensus.length < Math.ceil(input.length * 0.65)) return null;
  const retained = consensus.filter(
    (view) => residual(view, final) <= c.fitResidual,
  );
  if (angularSpan(retained) < c.minimumAngularSpan) return null;

  const stable = retained.filter(
    ({ count, spread }) =>
      count >= c.minimumFrames && spread <= c.repeatability,
  );
  return {
    width: Math.sqrt(final[0]),
    depth: Math.sqrt(final[1]),
    views: retained,
    repeatability: Math.max(
      ...retained.map((view) => Math.max(view.spread, residual(view, final))),
    ),
    angularSpan: angularSpan(retained),
    acquired: angularSpan(stable) >= c.minimumAngularSpan,
  };
}

export function robustPaths(views: readonly ViewEvidence[]) {
  const first = views[0];
  if (!first) return null;
  const candidate = first.values.map((_, index) =>
    median(views.map(({ values }) => values[index]))!,
  );
  const retained = views.filter(({ values }) =>
    values.every(
      (value, index) =>
        Math.abs(value / candidate[index] - 1) <= c.repeatability,
    ),
  );
  if (!retained.length || retained.length < Math.ceil(views.length * 0.65))
    return null;
  return {
    values: candidate,
    views: retained,
    repeatability: Math.max(
      ...retained.flatMap(({ values, spread }) => [
        spread,
        ...values.map((value, index) => Math.abs(value / candidate[index] - 1)),
      ]),
    ),
    acquired: retained.some(
      ({ count, spread }) =>
        count >= c.minimumFrames && spread <= c.repeatability,
    ),
  };
}
