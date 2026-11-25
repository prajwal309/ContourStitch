import { describe, expect, it } from 'vitest';
import { anthropometricPrior } from '@/lib/live-measurement/anthropometric-priors';
import {
  progressiveEstimates,
  progressiveMeasurementKeys,
} from '@/lib/live-measurement/progressive';
import { GuidedScan } from '@/lib/live-measurement/session';
import type { MeasurementReport } from '@/lib/measurement/types';
import type { Sample } from '@/lib/live-measurement/estimator';

const quality = (score: number) => ({
  landmarkConfidence: score,
  viewAlignment: score,
  imageQuality: score,
  segmentationStability: score,
  calibrationReliability: score,
  score,
});

function torsoSample(width: number, score = 0.9): Sample {
  return {
    scale: 1,
    torsoCm: width,
    widths: { chest: 40, waist: 34, hip: 42 },
    quality: quality(score),
  };
}

const chestReport: MeasurementReport = {
  estimates: [
    {
      key: 'chest',
      valueCm: 120,
      uncertaintyCm: null,
      confidence: 'low',
      method: 'Camera observation',
      warnings: [],
    },
  ],
  missing: {},
};

describe('height-conditioned progressive estimates', () => {
  it('initializes all requested values from the ANSUR II reference models', () => {
    const snapshot = new GuidedScan({
      kind: 'height',
      heightCm: 175,
    }).snapshot();

    expect(snapshot.report.estimates).toHaveLength(0);
    expect(snapshot.progressive.map(({ key }) => key)).toEqual(
      progressiveMeasurementKeys,
    );
    expect(
      snapshot.progressive.every(
        ({ source, valueCm }) => source === 'prior' && valueCm !== null,
      ),
    ).toBe(true);
    expect(anthropometricPrior('chest', 175)?.valueCm).toBeCloseTo(102.21, 1);
    expect(anthropometricPrior('inseam', 175)?.valueCm).toBeCloseTo(84.82, 1);
    expect(anthropometricPrior('torso', 175)?.valueCm).toBeCloseTo(36.9, 1);
    expect(
      anthropometricPrior('chest', 175)!.range95HalfWidthCm,
    ).toBeGreaterThan(anthropometricPrior('shoulder', 175)!.range95HalfWidthCm);
  });

  it('does not extrapolate population priors beyond the reference height range', () => {
    expect(anthropometricPrior('waist', 149.9)).toBeNull();
    expect(anthropometricPrior('waist', 190.1)).toBeNull();
  });

  it('weights camera observations by valid-frame coverage and capture quality', () => {
    const lowQuality = {
      front: [torsoSample(35, 0.3)],
      side: [torsoSample(30, 0.3)],
    };
    const highQuality = {
      front: Array.from({ length: 4 }, () => torsoSample(35, 0.9)),
      side: Array.from({ length: 4 }, () => torsoSample(30, 0.9)),
    };
    const low = progressiveEstimates(
      175,
      chestReport,
      lowQuality,
    ).find(({ key }) => key === 'chest')!;
    const high = progressiveEstimates(
      175,
      chestReport,
      highQuality,
    ).find(({ key }) => key === 'chest')!;

    expect(low.source).toBe('blended');
    expect(high.source).toBe('blended');
    expect(high.viewCoverage).toBeGreaterThan(low.viewCoverage);
    expect(high.sampleCount).toBeGreaterThan(low.sampleCount);
    expect(high.valueCm).toBeGreaterThan(low.valueCm!);
    expect(high.valueCm).toBeLessThanOrEqual(120);
  });

  it('widens the working range when a camera observation contradicts the prior', () => {
    const samples = {
      front: Array.from({ length: 4 }, () => torsoSample(35)),
      side: Array.from({ length: 4 }, () => torsoSample(30)),
    };
    const close = progressiveEstimates(
      175,
      {
        ...chestReport,
        estimates: [{ ...chestReport.estimates[0], valueCm: 103 }],
      },
      samples,
    ).find(({ key }) => key === 'chest')!;
    const contradictory = progressiveEstimates(
      175,
      chestReport,
      samples,
    ).find(({ key }) => key === 'chest')!;

    expect(contradictory.rangeHalfWidthCm).toBeGreaterThan(
      close.rangeHalfWidthCm!,
    );
  });

  it('uses torso landmarks as a separate camera observation and keeps inseam prior-only', () => {
    const report = { estimates: [], missing: {} };
    const estimates = progressiveEstimates(
      175,
      report,
      {
        front: [torsoSample(37), torsoSample(38)],
      },
    );
    const torso = estimates.find(({ key }) => key === 'torso')!;
    const inseam = estimates.find(({ key }) => key === 'inseam')!;

    expect(torso.cameraValueCm).toBeCloseTo(37.5);
    expect(torso.source).toBe('blended');
    expect(inseam.cameraValueCm).toBeUndefined();
    expect(inseam.source).toBe('prior');
  });

  it('keeps the supported camera result as the finalized value', () => {
    const finalized = progressiveEstimates(
      175,
      chestReport,
      {
        front: Array.from({ length: 4 }, () => torsoSample(35)),
        side: Array.from({ length: 4 }, () => torsoSample(30)),
      },
      true,
    ).find(({ key }) => key === 'chest')!;

    expect(finalized.source).toBe('camera');
    expect(finalized.valueCm).toBe(120);
  });
});
