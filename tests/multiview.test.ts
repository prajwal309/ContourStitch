// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ellipseCircumference } from '@/lib/measurement/circumference';
import { MultiViewScan } from '@/lib/live-measurement/multiview/engine';
import { fitSection, Keyframes } from '@/lib/live-measurement/multiview/fusion';
import { observeFrame } from '@/lib/live-measurement/multiview/observe';
import { createObservationClient } from '@/lib/live-measurement/multiview/worker-client';
import { sanitizeProfile } from '@/lib/storage/profile';
import { syntheticFrame } from './multiview-fixture';

const body = {
  height: 174,
  chest: [42, 28],
  waist: [35, 25],
  hip: [41, 29],
} as const;
const fixture = {
  ...body,
  chest: [...body.chest] as [number, number],
  waist: [...body.waist] as [number, number],
  hip: [...body.hip] as [number, number],
};

function feed(scan: MultiViewScan) {
  let timestamp = 0;
  return (
    angle: number,
    options?: Parameters<typeof syntheticFrame>[2],
    repetitions = 4,
  ) => {
    for (let i = 0; i < repetitions; i++)
      scan.update(
        observeFrame(
          syntheticFrame(fixture, angle, {
            ...options,
            timestamp: (timestamp += 510),
          }),
        ),
      );
    return scan.snapshot();
  };
}

describe('progressive multi-view reconstruction', () => {
  it('collects cropped torso views before scale, then preserves and resolves them after a full observation', () => {
    const scan = new MultiViewScan({ kind: 'height', heightCm: body.height });
    const run = feed(scan);
    run(0, { crop: 'upper', zoom: 1.4 });
    const relative = run(90, { crop: 'upper', zoom: 1.4 });
    expect(relative.calibrated).toBe(false);
    expect(relative.report.estimates).toHaveLength(0);
    expect(relative.evidence.find(({ key }) => key === 'chest')).toMatchObject({
      observed: true,
      acquired: false,
      metric: false,
      angleBuckets: 2,
    });
    const anchored = run(0);
    expect(anchored.calibrated).toBe(true);
    const chest = anchored.report.estimates.find(({ key }) => key === 'chest');
    expect(chest?.valueCm).toBeCloseTo(ellipseCircumference(42, 28)!, -1);
    expect(chest?.uncertaintyCm).toBeNull();
    const absent = run(0, { missing: [11, 12, 23, 24, 25, 26] });
    expect(absent.report.estimates).toContainEqual(chest);
    expect(absent.evidence.find(({ key }) => key === 'chest')?.visible).toBe(
      false,
    );
  });

  it('supports metric torso capture without seeing the whole body using a known reference scale', () => {
    const scan = new MultiViewScan({
      kind: 'reference',
      heightCm: body.height,
      anchorCm: { torso: body.height * 0.31 },
    });
    const run = feed(scan);
    const front = run(0, { crop: 'upper', zoom: 1.4 });
    expect(front.report.estimates.some(({ key }) => key === 'shoulder')).toBe(
      true,
    );
    expect(front.report.estimates.some(({ key }) => key === 'chest')).toBe(
      false,
    );
    expect(front.message).toMatch(/side faces the camera/);
    const finish = run(-90, { crop: 'upper', zoom: 1.4 });
    expect(finish.report.estimates.some(({ key }) => key === 'chest')).toBe(
      true,
    );
    expect(finish.mesh?.verticesCm.length).toBeGreaterThan(0);
    expect(
      scan.finish().progressive.find(({ key }) => key === 'inseam'),
    ).toMatchObject({
      valueCm: null,
      priorWeight: 0,
      status: 'Insufficient Data',
    });
  });

  it('preserves the progressive report through the existing saved-profile format', () => {
    const scan = new MultiViewScan({ kind: 'height', heightCm: body.height });
    const run = feed(scan);
    run(0);
    run(90);
    const { report } = scan.finish();
    const profile = sanitizeProfile({ version: 1, unit: 'cm', report });
    expect(profile?.report.source).toBe('progressive-video');
    expect(profile?.report.estimates.some(({ key }) => key === 'outseam')).toBe(
      true,
    );
    expect(profile?.report.estimates.some(({ key }) => key === 'inseam')).toBe(
      false,
    );
  });

  it('processes frames when browser workers are unavailable and discards requests after closing', async () => {
    const client = createObservationClient();
    const frame = syntheticFrame(fixture, 0);
    await expect(client.observe(frame)).resolves.toEqual(observeFrame(frame));
    client.close();
    await expect(client.observe(frame)).resolves.toBeNull();
  });

  it('uses a thigh anchor for lower-only observations and withholds unobserved upper regions', () => {
    const scan = new MultiViewScan({
      kind: 'reference',
      heightCm: body.height,
      anchorCm: { thigh: body.height * 0.2 },
    });
    const run = feed(scan);
    run(0, {
      crop: 'lower',
      zoom: 1.25,
      missing: [0, 7, 8, 11, 12, 13, 14, 15, 16],
    });
    const state = run(90, {
      crop: 'lower',
      zoom: 1.25,
      missing: [0, 7, 8, 11, 12, 13, 14, 15, 16],
    });
    expect(state.report.estimates.some(({ key }) => key === 'outseam')).toBe(
      true,
    );
    expect(state.report.estimates.some(({ key }) => key === 'hip')).toBe(true);
    expect(state.report.estimates.some(({ key }) => key === 'chest')).toBe(
      false,
    );
  });

  it('rejects clipped contours, occluded rows and low-quality frames', () => {
    const clipped = observeFrame(syntheticFrame(fixture, 0, { crop: 'left' }));
    expect(clipped.regions.every(({ widths }) => !widths.chest)).toBe(true);
    const occluded = observeFrame(
      syntheticFrame(fixture, 0, { occluded: true }),
    );
    expect(occluded.regions.every(({ widths }) => !widths.chest)).toBe(true);
    for (const degradation of [{ brightness: 2 }, { sharpness: 5 }]) {
      expect(
        observeFrame(syntheticFrame(fixture, 0, degradation)).regions,
      ).toHaveLength(0);
    }
  });

  it('does not turn duplicate frames or repeated angles into independent geometric evidence', () => {
    const keyframes = new Keyframes();
    for (let t = 0; t < 5000; t++)
      keyframes.add(2, { timestamp: t, values: [37], quality: 0.9 });
    expect(keyframes.summarize()).toMatchObject([{ count: 5 }]);
    const sameAngle = keyframes.summarize()[0];
    expect(fitSection([sameAngle, { ...sameAngle, angle: 178 }])).toBeNull();
  });

  it('can reject an inconsistent angle while fitting concordant intermediate views', () => {
    const angles = [0, 30, 45, 60, 90, 140];
    const fit = fitSection(
      angles.map((angle) => ({
        angle,
        quality: 0.9,
        count: 4,
        spread: 0.01,
        values: [
          angle === 140
            ? 67
            : Math.hypot(
                42 * Math.cos((angle * Math.PI) / 180),
                28 * Math.sin((angle * Math.PI) / 180),
              ),
        ],
      })),
    );
    expect(fit?.acquired).toBe(true);
    expect(fit?.views).toHaveLength(5);
    expect(fit?.width).toBeCloseTo(42);
    expect(fit?.depth).toBeCloseTo(28);
  });
});
