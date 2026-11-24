import { describe, it, expect } from 'vitest';
import { fixture } from './fixtures';
import { analyzeFrame, orientation } from '@/lib/scanner/analysis';
import { Scanner } from '@/lib/scanner/scanner';
import { extractFeatures, geometryBaseline } from '@/lib/scanner/features';
import { featureNames } from '@/lib/scanner/types';
import {
  preprocess,
  mapOutputs,
  outputNames,
} from '@/lib/scanner/measurementModel';
import { reconstructVisualHull } from '@/lib/reconstruction/visual-hull';
import type { VisionFrame } from '@/lib/vision/types';
function frame(angle = 0, timestamp = 0): VisionFrame {
  const f = fixture();
  f.timestamp = timestamp;
  // Keep a stable full-body position while rotating the synthetic shoulder axis.
  const radians = (angle * Math.PI) / 180;
  f.landmarks[11] = {
    x: 0.5 - 0.2 * Math.cos(radians),
    y: 0.25,
    z: 0.2 * Math.sin(radians),
    visibility: 0.99,
  };
  f.landmarks[12] = {
    x: 0.5 + 0.2 * Math.cos(radians),
    y: 0.25,
    z: -0.2 * Math.sin(radians),
    visibility: 0.99,
  };
  return f;
}
describe('video scanner', () => {
  it('classifies front, both sides, back and ambiguous angles', () => {
    expect([0, 90, 180, 270, 45].map(orientation)).toEqual([
      'FRONT',
      'LEFT_SIDE',
      'BACK',
      'RIGHT_SIDE',
      'UNKNOWN',
    ]);
    expect(orientation(null)).toBe('UNKNOWN');
  });
  it('uses signed depth for orientation', () => {
    expect(analyzeFrame(frame(90), null, null).orientation).toBe('LEFT_SIDE');
    expect(analyzeFrame(frame(180), null, null).orientation).toBe('BACK');
  });
  it('detects missing person, cropped feet, distance and centering', () => {
    const f = frame();
    f.poseCount = 0;
    expect(analyzeFrame(f, null, null).instruction).toBe('FIND_PERSON');
    f.poseCount = 1;
    f.landmarks[31].y = 1;
    expect(analyzeFrame(f, null, null).instruction).toBe('SHOW_FULL_BODY');
    const far = frame();
    far.mask = null;
    far.landmarks = far.landmarks.map((p) => ({ ...p, y: 0.3 + p.y * 0.45 }));
    expect(analyzeFrame(far, null, null).instruction).toBe('MOVE_CLOSER');
    const close = frame();
    close.mask = null;
    close.landmarks = close.landmarks.map((p) => ({
      ...p,
      y: 0.031 + (p.y - 0.12) * 1.15,
    }));
    expect(analyzeFrame(close, null, null).instruction).toBe('MOVE_BACK');
    const left = frame();
    left.landmarks = left.landmarks.map((p) => ({ ...p, x: p.x - 0.11 }));
    expect(analyzeFrame(left, null, null).instruction).toBe('MOVE_RIGHT');
    const right = frame();
    right.landmarks = right.landmarks.map((p) => ({ ...p, x: p.x + 0.11 }));
    expect(analyzeFrame(right, null, null).instruction).toBe('MOVE_LEFT');
  });
  it('requires a stable front then actual ordered view coverage to complete', () => {
    const scanner = new Scanner({ type: 'KNOWN_HEIGHT', heightCm: 170 });
    let time = 0;
    expect(scanner.update(frame(0, time)).state).toBe('FRONT_CAPTURE');
    for (time = 100; time <= 1500; time += 100) scanner.update(frame(0, time));
    expect(scanner.snapshot.state).toBe('ROTATING');
    for (let a = 2; a <= 360; a += 2) {
      scanner.update(frame(a, time));
      time += 100;
    }
    for (let i = 0; i < 15; i++) {
      scanner.update(frame(0, time));
      time += 100;
    }
    expect(scanner.snapshot.state).toBe('COMPLETE');
    expect(scanner.snapshot.progress).toBe(100);
    expect(scanner.snapshot.result?.features.chestFrontRatio).toBeGreaterThan(
      0,
    );
  }, 15_000);
  it.each([4, 8])(
    'captures quality-gated binary silhouettes for %i requested turn angles',
    (viewCount) => {
      const scanner = new Scanner(
        { type: 'KNOWN_HEIGHT', heightCm: 170 },
        { silhouetteViewCount: viewCount },
      );
      let time = 0;
      for (time = 0; time <= 1500; time += 100) scanner.update(frame(0, time));
      for (let angle = 2; angle <= 360; angle += 2) {
        scanner.update(frame(angle, time));
        time += 100;
      }
      for (let i = 0; i < 15; i++) {
        scanner.update(frame(0, time));
        time += 100;
      }
      const captures = scanner.snapshot.result?.silhouetteViews ?? [];
      expect(scanner.snapshot.state).toBe('COMPLETE');
      expect(captures.length).toBeGreaterThanOrEqual(4);
      expect(captures.length).toBeLessThanOrEqual(viewCount);
      expect(
        captures.every((capture) => capture.data.every((pixel) => pixel <= 1)),
      ).toBe(true);
      expect(scanner.snapshot.silhouetteTargetViews).toBe(viewCount);
      expect(() =>
        reconstructVisualHull({ heightCm: 170, views: captures }),
      ).not.toThrow();
    },
    15_000,
  );
  it('does not finish on elapsed time alone and times out', () => {
    const s = new Scanner({ type: 'KNOWN_HEIGHT', heightCm: 170 });
    s.update(frame(0, 0));
    expect(s.update(frame(0, 121000)).state).toBe('ERROR');
  });
  it('rejects stale tracking during a turn', () => {
    const s = new Scanner({ type: 'KNOWN_HEIGHT', heightCm: 170 });
    for (let t = 0; t <= 1500; t += 100) s.update(frame(0, t));
    expect(s.update(frame(20, 3000)).state).toBe('ERROR');
  });
  it('preserves missing silhouettes instead of fabricating measurements', () => {
    const f = frame();
    f.mask = null;
    expect(extractFeatures(f).chest).toBeNull();
    const result = geometryBaseline(
      Object.fromEntries(
        featureNames.map((name) => [name, name === 'heightCm' ? 170 : null]),
      ) as Parameters<typeof geometryBaseline>[0],
    );
    expect(result.chestCm).toBeNull();
    expect(result.inseamCm).toBeNull();
  });
  it('shares exact browser/Python feature and output order', async () => {
    const contract = await import('../ml/src/features.json');
    expect(contract.featureNames).toEqual(featureNames);
    expect(contract.outputNames).toEqual(outputNames);
  });
  it('preprocesses in deterministic order and validates missing data', () => {
    const f = Object.fromEntries(
      featureNames.map((name, i) => [name, i + 2]),
    ) as Parameters<typeof preprocess>[0];
    const p = {
      mean: featureNames.map(() => 1),
      std: featureNames.map(() => 2),
      targetMean: outputNames.map(() => 10),
      targetStd: outputNames.map(() => 2),
    };
    expect([...preprocess(f, p)]).toEqual(
      featureNames.map((_, i) => (i + 1) / 2),
    );
    expect(
      mapOutputs(
        outputNames.map((_, i) => i),
        p,
      ).neckCm,
    ).toBe(24);
    expect(() => preprocess({ ...f, chestSideRatio: null }, p)).toThrow(
      'Missing',
    );
    expect(() => mapOutputs([1], p)).toThrow('dimensions');
  });
});
