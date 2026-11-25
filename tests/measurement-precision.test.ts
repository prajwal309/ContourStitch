import { describe, expect, it } from 'vitest';
import type { Sample } from '@/lib/live-measurement/estimator';
import {
  formatPrecision,
  precisionProgress,
} from '@/lib/live-measurement/precision';
import { progressiveEstimates } from '@/lib/live-measurement/progressive';
import type { MeasurementReport } from '@/lib/measurement/types';

const confirmed: MeasurementReport = {
  estimates: [
    {
      key: 'chest',
      valueCm: 108,
      confidence: 'low',
      uncertaintyCm: null,
      method: 'Camera contours',
      warnings: [],
    },
  ],
  missing: {},
};
const empty = { estimates: [], missing: {} };
const samples = (widths: number[]): Sample[] =>
  widths.map((chest) => ({
    scale: 0.8,
    resolutionCm: 0.4,
    widths: { chest },
  }));
const chest = (
  views: Parameters<typeof progressiveEstimates>[2],
  accepted = confirmed,
  estimates = confirmed,
) =>
  progressiveEstimates(170, estimates, views, false, accepted).find(
    ({ key }) => key === 'chest',
  )!;
const consistent = {
  front: samples([41, 41, 41, 41]),
  side: samples([27, 27, 27, 27]),
};

describe('camera precision feedback', () => {
  it('withholds a progress value for references or incomplete camera views', () => {
    expect(
      precisionProgress(chest({}, empty, empty).cameraPrecision),
    ).toBeNull();
    expect(
      precisionProgress(
        chest({ front: consistent.front }, empty, empty).cameraPrecision,
      ),
    ).toBeNull();
    expect(
      precisionProgress(chest(consistent, empty, empty).cameraPrecision),
    ).toBeNull();
  });

  it('uses camera repeatability and requires a confirmed estimate and consecutive observations', () => {
    const precision = chest(consistent).cameraPrecision!;
    expect(precision.uncertaintyCm).toBeGreaterThan(0);
    expect(precision.uncertaintyCm).toBeLessThanOrEqual(2);
    expect(precisionProgress(precision)).toMatchObject({
      acquired: true,
      fraction: 1,
      durationMs: 0,
    });
    expect(
      precisionProgress(chest(consistent, empty).cameraPrecision)?.acquired,
    ).toBe(false);
    const gap = {
      ...consistent,
      side: [...consistent.side, { scale: 0.8, widths: {} }],
    };
    expect(precisionProgress(chest(gap).cameraPrecision)?.acquired).toBe(false);
  });

  it('reopens the estimate and regresses when rear evidence widens the camera range', () => {
    const revised = chest({
      ...consistent,
      back: samples([49, 50, 50]),
    }).cameraPrecision!;
    expect(revised.uncertaintyCm).toBeGreaterThan(2);
    expect(precisionProgress(revised)).toMatchObject({ acquired: false });
    expect(precisionProgress(revised)!.fraction).toBeLessThan(1);
  });

  it('slows transitions near the threshold without changing the progress target', () => {
    const coarse = precisionProgress({ uncertaintyCm: 8, stable: false })!;
    const refined = precisionProgress({ uncertaintyCm: 4, stable: false })!;
    const near = precisionProgress({ uncertaintyCm: 2.1, stable: false })!;
    expect(coarse.fraction).toBe(0.25);
    expect(refined.fraction).toBe(0.5);
    expect(coarse.durationMs).toBeLessThan(refined.durationMs);
    expect(refined.durationMs).toBeLessThan(near.durationMs);
    expect(
      precisionProgress({ uncertaintyCm: 2, stable: false })?.fraction,
    ).toBe(0.99);
    expect(formatPrecision(2.03)).toBe('2.1');
    expect(formatPrecision(4.2)).toBe('4.2');
  });
});
