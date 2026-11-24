import { describe, it, expect } from 'vitest';
import { pixelScale } from '@/lib/measurement/scale';
import { ellipseCircumference } from '@/lib/measurement/circumference';
import { landmarkPath } from '@/lib/measurement/landmarks';
import { robustWidth } from '@/lib/measurement/silhouette';
import { uncertainty } from '@/lib/measurement/uncertainty';
import { estimateMeasurements } from '@/lib/measurement/estimate';
import { fixture } from './fixtures';
describe('measurement geometry', () => {
  it('anchors scale and rejects invalid data', () => {
    expect(pixelScale(180, 900)).toBe(0.2);
    expect(pixelScale(180, 0)).toBeNull();
    expect(pixelScale(NaN, 900)).toBeNull();
  });
  it('matches a circle and known ellipse', () => {
    expect(ellipseCircumference(20, 20)).toBeCloseTo(20 * Math.PI, 8);
    expect(ellipseCircumference(20, 10)).toBeCloseTo(48.442, 2);
    expect(ellipseCircumference(-1, 10)).toBeNull();
  });
  it('samples robustly across noisy neighboring rows', () => {
    const mask = fixture().mask!;
    expect(robustWidth(mask, 160, 100)).toBe(81);
    for (let x = 30; x < 170; x++) mask.data[160 * mask.width + x] = 1;
    expect(robustWidth(mask, 160, 100)).toBe(81);
    expect(robustWidth(mask, 160, 1)).toBeNull();
  });
  it('uses pixel aspect ratio for limb paths and rejects low visibility', () => {
    const points = [
      { x: 0.1, y: 0.1, z: 0, visibility: 1 },
      { x: 0.4, y: 0.5, z: 0, visibility: 1 },
    ];
    expect(landmarkPath(points, 100, 100)).toBeCloseTo(50);
    points[1].visibility = 0.2;
    expect(landmarkPath(points, 100, 100)).toBeNull();
  });
  it('keeps capture confidence separate from uncalibrated physical uncertainty', () => {
    const q = fixture().quality;
    const base = uncertainty('waist', [q]);
    const bad = uncertainty(
      'waist',
      [
        {
          ...q,
          override: true,
          landmarkConfidence: 0.5,
          segmentationInstability: 0.8,
        },
      ],
      0.4,
    );
    expect(base.uncertaintyCm).toBeNull();
    expect(bad.uncertaintyCm).toBeNull();
    expect(bad.confidence).toBe('low');
    expect(bad.warnings.join(' ')).toContain('overridden');
    expect(bad.warnings.join(' ')).toContain(
      'not a calibrated physical uncertainty range',
    );
  });
  it('derives all eight estimates from constrained evidence', () => {
    const report = estimateMeasurements(175, fixture(), fixture('side'));
    expect(report.estimates).toHaveLength(8);
    expect(report.estimates.find((e) => e.key === 'inseam')?.confidence).toBe(
      'low',
    );
    expect(report.estimates.every((e) => e.uncertaintyCm === null)).toBe(true);
  });
  it('never fabricates missing silhouettes or landmarks', () => {
    const front = fixture();
    front.mask = null;
    const report = estimateMeasurements(175, front, fixture('side'));
    expect(report.estimates.map((e) => e.key)).toEqual(['height']);
    expect(report.missing.chest).toContain('missing');
  });
  it('rejects a cropped body and missing leg gap', () => {
    const front = fixture();
    front.landmarks[0].visibility = 0.1;
    expect(
      estimateMeasurements(175, front, fixture('side')).missing.shoulder,
    ).toBeDefined();
    const filled = fixture();
    for (let y = 240; y < 376; y++)
      for (let x = 94; x <= 106; x++) filled.mask!.data[y * 200 + x] = 1;
    expect(
      estimateMeasurements(175, filled, fixture('side')).missing.inseam,
    ).toBeDefined();
  });
});
