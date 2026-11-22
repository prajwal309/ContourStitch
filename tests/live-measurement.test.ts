import { describe, expect, it } from 'vitest';
import { calibrateReference } from '@/lib/live-measurement/calibration';
import {
  silhouetteEstimator,
  type Sample,
} from '@/lib/live-measurement/estimator';
import {
  facing,
  frameFraming,
  poseFeedback,
  poses,
  type Pose,
} from '@/lib/live-measurement/guidance';
import { GuidedScan } from '@/lib/live-measurement/session';
import { liveMeasurementKeys } from '@/lib/measurement/types';
import {
  correctMeasurement,
  mergeMeasurements,
} from '@/lib/measurement/corrections';
import { prepareProfile, restoreProfile } from '@/lib/accounts/profile-data';
import { liveFrame } from './live-fixture';

const calibration = { kind: 'height', heightCm: 175 } as const;

describe('guided video measurements', () => {
  it('recognizes anatomical left and right in the unmirrored front, side and rear', () => {
    for (const pose of ['front', 'side', 'back'] as const)
      expect(facing(liveFrame(pose))).toBe(pose);
    expect(poseFeedback(liveFrame('front'), 'extended')).toContain(
      'Extend your arms',
    );
    expect(poseFeedback(liveFrame('extended'), 'extended')).toBeNull();
    expect(poseFeedback(liveFrame('neck'), 'neck')).toBeNull();
  });

  it('rejects dark, blurred, cropped, multi-person and occluded frames', () => {
    const frame = liveFrame('front');
    expect(frameFraming({ ...frame, brightness: 5 }).bounds).toBeNull();
    expect(frameFraming({ ...frame, sharpness: 5 }).bounds).toBeNull();
    expect(frameFraming({ ...frame, poseCount: 2 }).bounds).toBeNull();
    expect(frameFraming({ ...frame, mask: null }).bounds).toBeNull();
    frame.mask!.data[160] = 1;
    expect(frameFraming(frame).message).toContain('whole body');
    frame.landmarks[15].visibility = 0.1;
    expect(poseFeedback(frame, 'front')).toContain('arms slightly away');
  });

  it('calibrates a known-size segment and rejects a mismatched reference', () => {
    expect(calibrateReference(175, 50, 350, 100)).toEqual({
      kind: 'reference',
      heightCm: 175,
    });
    expect(calibrateReference(175, 80, 350, 100)).toBeNull();
    expect(calibrateReference(175, 50, 350, 4)).toBeNull();
  });

  it('requires a continuous hold and refines all supported measures across five views', () => {
    const scan = new GuidedScan(calibration);
    for (let i = 0; i < 3; i++) scan.update(liveFrame('front', i * 250));
    expect(
      scan.update({ ...liveFrame('front', 750), sharpness: 0 }).index,
    ).toBe(0);
    expect(scan.update(liveFrame('front', 1000)).index).toBe(0);

    let time = 1500;
    for (const { id } of poses) {
      let current = scan.snapshot();
      const initialIndex = current.index;
      for (let i = 0; i < 8 && current.index === initialIndex; i++) {
        current = scan.update(liveFrame(id, time));
        time += 250;
      }
      expect(current.index).toBe(initialIndex + 1);
    }

    const result = scan.snapshot();
    expect(result.complete).toBe(true);
    expect(result.report.estimates.map(({ key }) => key)).toEqual(
      liveMeasurementKeys,
    );
    expect(
      result.report.estimates.every(
        ({ uncertaintyCm }) => uncertaintyCm === null,
      ),
    ).toBe(true);
    const arm = result.report.estimates.find(({ key }) => key === 'arm');
    expect(arm?.sidesCm?.left).toBeGreaterThan(arm?.sidesCm?.right ?? 0);
    expect(arm?.warnings.join(' ')).toContain('left and right');
  });

  it('refines provisional values with each valid frame and excludes an interrupted hold from review', () => {
    const scan = new GuidedScan(calibration);
    const sleeve = (snapshot: ReturnType<GuidedScan['snapshot']>) =>
      snapshot.provisional?.estimates.find(({ key }) => key === 'sleeve')
        ?.valueCm;

    for (let i = 0; i < 3; i++) {
      expect(sleeve(scan.update(liveFrame('front', i * 100)))).toBeUndefined();
    }
    const initial = scan.update(liveFrame('front', 300));
    expect(sleeve(initial)).toBeGreaterThan(0);
    expect(initial.report.estimates).toHaveLength(0);

    let update = initial;
    for (let i = 4; i < 8; i++) {
      const frame = liveFrame('front', i * 100);
      frame.landmarks[15].y += 0.015;
      update = scan.update(frame);
    }
    expect(sleeve(update)).toBeDefined();
    expect(sleeve(update)).not.toBe(sleeve(initial));
    expect(update.index).toBe(0);
    expect(update.report.estimates).toHaveLength(0);

    const blurred = { ...liveFrame('front', 800), sharpness: 0 };
    expect(scan.update(blurred).provisional).toBeNull();
    expect(scan.skip().report.estimates).toHaveLength(0);
  });

  it('withholds circumferences when views are absent, jittery or disagree in scale', () => {
    const collect = (pose: Pose) => {
      const frame = liveFrame(pose);
      return silhouetteEstimator.sample(
        frame,
        frameFraming(frame).bounds!,
        pose,
        calibration,
      )!;
    };
    const front = Array.from({ length: 5 }, () => collect('front'));
    const side = Array.from({ length: 5 }, () => collect('side'));
    const estimate = (views: Partial<Record<Pose, Sample[]>>) =>
      silhouetteEstimator.report(views, calibration);
    expect(
      estimate({ front }).estimates.some(({ key }) => key === 'chest'),
    ).toBe(false);
    expect(
      estimate({ front, side }).estimates.some(({ key }) => key === 'chest'),
    ).toBe(true);
    expect(estimate({ front, side }).missing.neck).toBeDefined();
    expect(
      estimate({
        front,
        side: side.map((sample) => ({ ...sample, scale: sample.scale * 0.65 })),
      }).missing.waist,
    ).toBeDefined();
    side[0].widths.chest = 10;
    side[1].widths.chest = 60;
    expect(estimate({ front, side }).missing.chest).toBeDefined();
  });

  it('round-trips experimental evidence and corrections in the existing profile payload', () => {
    const draft = correctMeasurement(
      {
        source: 'live-video',
        missing: {},
        estimates: [
          {
            key: 'arm',
            valueCm: 52,
            uncertaintyCm: null,
            confidence: 'low',
            method: 'Experimental scan',
            warnings: [],
            sidesCm: { left: 51, right: 53 },
          },
        ],
      },
      'arm',
      54,
    );
    const saved = mergeMeasurements(
      correctMeasurement({ estimates: [], missing: {} }, 'inseam', 76),
      draft,
    );
    const data = prepareProfile({ version: 1, unit: 'in', report: saved });
    expect(data).not.toBeNull();
    expect(data?.corrections).toEqual({ arm: 54, inseam: 76 });
    expect(restoreProfile(data!)?.report.originalEstimates?.[0]).toMatchObject({
      key: 'arm',
      uncertaintyCm: null,
      sidesCm: { left: 51, right: 53 },
    });
  });
});
