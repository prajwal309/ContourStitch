import { describe, expect, it } from 'vitest';
import { summarizeBenchmarks } from '@/lib/reconstruction/benchmark';
import type {
  BenchmarkCase,
  SilhouetteObservation,
} from '@/lib/reconstruction/types';
import { reconstructVisualHull } from '@/lib/reconstruction/visual-hull';

function views(count: number): SilhouetteObservation[] {
  const width = 64;
  const height = 64;
  const halfX = 0.12;
  const halfY = 0.08;
  return Array.from({ length: count }, (_, viewIndex) => {
    const angleDegrees = (viewIndex / count) * 360;
    const angle = (angleDegrees * Math.PI) / 180;
    const halfWidth =
      Math.abs(Math.cos(angle)) * halfX + Math.abs(Math.sin(angle)) * halfY;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const horizontal = x / (width - 1) - 0.5;
        if (Math.abs(horizontal) <= halfWidth) data[y * width + x] = 1;
      }
    }
    return { angleDegrees, width, height, data, quality: 0.9 };
  });
}

describe('independent visual hull engine', () => {
  it.each([4, 8, 16, 32, 64])('accepts %i silhouette views', (count) => {
    const result = reconstructVisualHull(
      { heightCm: 170, views: views(count) },
      { x: 16, y: 16, z: 24 },
    );
    expect(result.engine).toBe('visual-hull');
    expect(result.quality.viewCount).toBe(count);
    expect(result.quality.calibrated).toBe(false);
    expect(result.mesh.verticesCm.length).toBeGreaterThan(0);
    expect(result.mesh.indices.length % 3).toBe(0);
    expect(result.estimates.map(({ key }) => key)).toEqual([
      'chest',
      'waist',
      'hip',
    ]);
    expect(
      result.estimates.every(({ uncertaintyCm }) => uncertaintyCm === null),
    ).toBe(true);
  });

  it('rejects invalid scale, mismatched silhouettes, and oversized grids', () => {
    expect(() =>
      reconstructVisualHull({ heightCm: 0, views: views(4) }),
    ).toThrow(/Height/);
    const mismatched = views(4);
    mismatched[3] = {
      ...mismatched[3],
      width: 32,
      data: new Uint8Array(32 * mismatched[3].height),
    };
    expect(() =>
      reconstructVisualHull({ heightCm: 170, views: mismatched }),
    ).toThrow(/same dimensions/);
    expect(() =>
      reconstructVisualHull(
        { heightCm: 170, views: views(4) },
        { x: 128, y: 128, z: 128 },
      ),
    ).toThrow(/voxels/);
  });

  it('rejects duplicate or narrowly clustered turn angles', () => {
    const duplicated = views(4).map((view) => ({
      ...view,
      angleDegrees: 0,
    }));
    expect(() =>
      reconstructVisualHull({ heightCm: 170, views: duplicated }),
    ).toThrow(/distinct rotation angles/);
    const clustered = views(4).map((view, index) => ({
      ...view,
      angleDegrees: index * 10,
    }));
    expect(() =>
      reconstructVisualHull({ heightCm: 170, views: clustered }),
    ).toThrow(/rotation coverage/);
  });
});

describe('benchmark summaries', () => {
  it('computes error, latency, failures, and empirical interval coverage', () => {
    const cases: BenchmarkCase[] = [
      {
        id: 'a',
        engine: 'visual-hull',
        key: 'chest',
        viewCount: 8,
        predictedCm: 100,
        referenceCm: 98,
        uncertaintyCm: 2,
        latencyMs: 100,
        failed: false,
      },
      {
        id: 'b',
        engine: 'visual-hull',
        key: 'chest',
        viewCount: 8,
        predictedCm: 96,
        referenceCm: 100,
        uncertaintyCm: 1,
        latencyMs: 200,
        failed: false,
      },
      {
        id: 'c',
        engine: 'visual-hull',
        key: 'chest',
        viewCount: 8,
        predictedCm: null,
        referenceCm: 100,
        uncertaintyCm: null,
        latencyMs: null,
        failed: true,
      },
    ];
    expect(summarizeBenchmarks(cases)).toEqual([
      {
        engine: 'visual-hull',
        key: 'chest',
        viewCount: 8,
        sampleCount: 3,
        failureRate: 1 / 3,
        biasCm: -1,
        maeCm: 3,
        rmseCm: Math.sqrt(10),
        percentile95AbsoluteErrorCm: 4,
        meanLatencyMs: 150,
        uncertaintyCoverage: 0.5,
      },
    ]);
  });

  it('does not turn empty or invalid benchmark inputs into success-shaped metrics', () => {
    expect(summarizeBenchmarks([])).toEqual([]);
    expect(() =>
      summarizeBenchmarks([
        {
          id: 'bad',
          engine: 'baseline',
          key: 'chest',
          predictedCm: Number.NaN,
          referenceCm: 100,
          uncertaintyCm: null,
          latencyMs: null,
          failed: false,
        },
      ]),
    ).toThrow(/Invalid benchmark case/);
  });
});
