// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { expect, it } from 'vitest';
import { GuidedScan } from '@/lib/live-measurement/session';
import { MultiViewScan } from '@/lib/live-measurement/multiview/engine';
import { observeFrame } from '@/lib/live-measurement/multiview/observe';
import { Scanner } from '@/lib/scanner/scanner';
import { geometryBaseline } from '@/lib/scanner/features';
import { reconstructVisualHull } from '@/lib/reconstruction/visual-hull';
import { syntheticFrame, type SyntheticBody } from './multiview-fixture';

const sections = ['chest', 'waist', 'hip'] as const;
type Section = (typeof sections)[number];
type Variant = ConstructorParameters<typeof MultiViewScan>[2];
type Scenario = NonNullable<Parameters<typeof syntheticFrame>[2]>;
const bodies: SyntheticBody[] = [
  { height: 160, chest: [35, 24], waist: [29, 23], hip: [37, 28] },
  { height: 174, chest: [42, 28], waist: [35, 25], hip: [41, 29] },
  { height: 188, chest: [49, 33], waist: [40, 31], hip: [46, 36] },
];

function perimeter([w, d]: [number, number]) {
  return (
    (Array.from({ length: 2048 }, (_, i) => {
      const theta = (i * Math.PI) / 1024;
      return Math.hypot(w * Math.sin(theta), d * Math.cos(theta));
    }).reduce((sum, value) => sum + value, 0) *
      Math.PI) /
    2048
  );
}

const cases: Record<string, (angle: number, i: number) => Scenario> = {
  clean: () => ({}),
  partialUpper: (angle) =>
    Math.abs(angle) > 30 ? { crop: 'upper', zoom: 1.35 } : {},
  partialLower: (angle) =>
    Math.abs(angle) > 30
      ? { crop: 'lower', zoom: 1.2, missing: [0, 7, 8, 11, 12, 13, 14, 15, 16] }
      : {},
  permanentCrop: () => ({ crop: 'upper', zoom: 1.35 }),
  distance: (_angle, index) => ({
    zoom: 0.78 + 0.36 * ((index % 6) / 5),
    offset: index % 2 ? 0.04 : -0.04,
  }),
  occlusion: (_angle, index) => ({
    occluded: index % 4 === 0,
    missing: index % 7 === 0 ? [11, 12] : [],
  }),
  looseClothing: () => ({ looseClothing: true }),
  lightingBlur: (_angle, index) => ({
    brightness: index % 5 === 0 ? 25 : 95,
    sharpness: index % 4 === 1 ? 12 : 65,
  }),
  lowResolution: () => ({ size: 96 }),
};

type Method =
  | 'progressive'
  | 'full-body-only'
  | 'front-side-only'
  | 'without-priors'
  | 'guided'
  | 'baseline'
  | 'visual-hull'
  | 'parametric';
type Row = {
  scenario: string;
  body: number;
  engine: Method;
  key: Section;
  referenceCm: number;
  predictedCm: number | null;
  convergenceSeconds: number | null;
  latencyMs: number | null;
  p95FrameMs: number | null;
};

function mean(list: readonly number[]) {
  return list.length
    ? list.reduce((sum, value) => sum + value, 0) / list.length
    : null;
}

function percentile(list: readonly number[], fraction: number) {
  return (
    [...list].sort((a, b) => a - b)[Math.ceil(list.length * fraction) - 1] ??
    null
  );
}

it.skipIf(!process.env.CONTOURSTITCH_BENCHMARK)(
  'runs the shared synthetic reconstruction and ablation benchmark',
  () => {
    const started = process.cpuUsage();
    const rows: Row[] = [];
    // The same timeline includes frontend-friendly holds and a continuous turn.
    const captures: { angle: number; armPose?: Scenario['armPose'] }[] = [
      ...Array.from({ length: 6 }, () => ({ angle: 0 })),
      ...Array.from({ length: 5 }, () => ({
        angle: 0,
        armPose: 'extended' as const,
      })),
      ...Array.from({ length: 6 }, () => ({ angle: -90 })),
      ...Array.from({ length: 6 }, () => ({ angle: 180 })),
      ...Array.from({ length: 6 }, () => ({
        angle: 0,
        armPose: 'relaxed' as const,
      })),
      ...Array.from({ length: 36 }, (_, index) => ({ angle: (index + 1) * 5 })),
      ...Array.from({ length: 8 }, () => ({ angle: 180 })),
      ...Array.from({ length: 72 }, (_, index) => ({
        angle: 180 + (index + 1) * 5,
      })),
      ...Array.from({ length: 6 }, () => ({ angle: 540 })),
    ];
    for (const [scenario, setup] of Object.entries(cases)) {
      for (const [index, body] of bodies.entries()) {
        const legacyCalibration = {
          kind: 'height' as const,
          heightCm: body.height,
        };
        const variants: Partial<Record<Method, Variant>> = {
          progressive: {},
          'full-body-only': { fullBodyOnly: true },
          'front-side-only': { frontSideOnly: true },
          'without-priors': { displayPriors: false },
        };
        const progressive = Object.entries(variants).map(([name, variant]) => ({
          name: name as Method,
          scan: new MultiViewScan(legacyCalibration, body.height, variant),
          times: [] as number[],
          first: new Map<string, number>(),
        }));
        const guide = new GuidedScan(legacyCalibration);
        const scanner = new Scanner(
          { type: 'KNOWN_HEIGHT', heightCm: body.height },
          { silhouetteViewCount: 8 },
        );
        const guidedMs: number[] = [];
        const baselineMs: number[] = [];
        let guideState = guide.snapshot();
        for (const [frameIndex, capture] of captures.entries()) {
          const { angle } = capture;
          const timestamp = (frameIndex + 1) * 510;
          const options = setup(angle, frameIndex);
          const frame = syntheticFrame(body, angle, {
            ...options,
            timestamp,
            farVisibility: 0.89,
            armPose: capture.armPose,
          });
          const sampleAt = performance.now();
          const observation = observeFrame(frame);
          const observationTime = performance.now() - sampleAt;
          for (const engine of progressive) {
            const fusionAt = performance.now();
            const snapshot = engine.scan.update(observation);
            engine.times.push(observationTime + performance.now() - fusionAt);
            for (const { key } of snapshot.report.estimates)
              if (!engine.first.has(key))
                engine.first.set(key, timestamp / 1000);
          }
          const guideAt = performance.now();
          guideState = guide.update(frame);
          guidedMs.push(performance.now() - guideAt);
          const baselineAt = performance.now();
          scanner.update(frame);
          baselineMs.push(performance.now() - baselineAt);
        }

        const result = scanner.snapshot.result;
        const baseline = result && geometryBaseline(result.features);
        const hullStarted = performance.now();
        let hull: ReturnType<typeof reconstructVisualHull> | undefined;
        if (result?.silhouetteViews && result.silhouetteViews.length >= 4) {
          const silhouettes = result.silhouetteViews;
          const angles = silhouettes
            .map(({ angleDegrees }) => angleDegrees)
            .sort((a, b) => a - b);
          const maximumGap = Math.max(
            ...angles.map(
              (angle, index) => (angles[index + 1] ?? angles[0] + 360) - angle,
            ),
          );
          if (maximumGap <= 135)
            hull = reconstructVisualHull({
              heightCm: body.height,
              views: silhouettes,
            });
        }
        const hullTime = performance.now() - hullStarted;
        const push = (
          engine: Method,
          key: Section,
          predictedCm: number | null,
          times: number[],
          convergenceSeconds: number | null,
          finishMs = 0,
        ) =>
          rows.push({
            scenario,
            body: index + 1,
            engine,
            key,
            referenceCm: perimeter(body[key]),
            predictedCm,
            convergenceSeconds,
            latencyMs: times.length
              ? times.reduce((sum, value) => sum + value, finishMs)
              : null,
            p95FrameMs: percentile(times, 0.95),
          });

        for (const key of sections) {
          for (const engine of progressive) {
            const prediction = engine.scan
              .snapshot()
              .report.estimates.find((value) => value.key === key)?.valueCm;
            push(
              engine.name,
              key,
              prediction ?? null,
              engine.times,
              engine.first.get(key) ?? null,
            );
          }
          const sessionSeconds = captures.length * 0.51;
          const guided =
            guideState.report.estimates.find((value) => value.key === key)
              ?.valueCm ?? null;
          push('guided', key, guided, guidedMs, null);
          const baselineValue = baseline?.[`${key}Cm`] ?? null;
          push(
            'baseline',
            key,
            baselineValue,
            baselineMs,
            baselineValue === null ? null : sessionSeconds,
          );
          const hullValue =
            hull?.estimates.find((value) => value.key === key)?.valueCm ?? null;
          push(
            'visual-hull',
            key,
            hullValue,
            baselineMs,
            hullValue === null ? null : sessionSeconds,
            hullTime,
          );
          push('parametric', key, null, [], null);
        }
      }
    }
    const summary = (rowsToSummarize: readonly Row[]) => {
      const matched = rowsToSummarize.filter(
        (row): row is Row & { predictedCm: number } => row.predictedCm !== null,
      );
      const errors = matched.map(
        ({ predictedCm, referenceCm }) => predictedCm - referenceCm,
      );
      const processing = rowsToSummarize.flatMap(({ p95FrameMs }) =>
        p95FrameMs === null ? [] : [p95FrameMs],
      );
      return {
        total: rowsToSummarize.length,
        acquired: matched.length,
        completionRate: matched.length / rowsToSummarize.length,
        biasCm: mean(errors),
        maeCm: mean(errors.map(Math.abs)),
        rmseCm: errors.length
          ? Math.sqrt(mean(errors.map((value) => value ** 2))!)
          : null,
        medianAbsoluteErrorCm: percentile(errors.map(Math.abs), 0.5),
        meanPercentageError: mean(
          matched.map(
            ({ predictedCm, referenceCm }) =>
              (100 * Math.abs(predictedCm - referenceCm)) / referenceCm,
          ),
        ),
        medianConvergenceSeconds: percentile(
          matched.flatMap((row) =>
            row.convergenceSeconds === null ? [] : [row.convergenceSeconds],
          ),
          0.5,
        ),
        medianSessionProcessingMs: percentile(
          rowsToSummarize.flatMap((row) =>
            row.latencyMs === null ? [] : [row.latencyMs],
          ),
          0.5,
        ),
        medianP95FrameMs: percentile(processing, 0.5),
        uncertaintyCoverage: null,
      };
    };
    const methods = [...new Set(rows.map(({ engine }) => engine))];
    const report = {
      host: {
        platform: process.platform,
        arch: process.arch,
        cpu: cpus()[0]?.model,
        node: process.version,
      },
      processCpuUs: process.cpuUsage(started),
      processPeakRssKiB: process.resourceUsage().maxRSS,
      measurementsCompared: sections,
      engines: Object.fromEntries(
        methods.map((name) => {
          const engineRows = rows.filter(({ engine }) => engine === name);
          return [
            name,
            {
              ...summary(engineRows),
              byMeasurement: Object.fromEntries(
                sections.map((key) => [
                  key,
                  summary(engineRows.filter((row) => row.key === key)),
                ]),
              ),
              byScenario: Object.fromEntries(
                Object.keys(cases).map((scenario) => [
                  scenario,
                  summary(
                    engineRows.filter((row) => row.scenario === scenario),
                  ),
                ]),
              ),
            },
          ];
        }),
      ),
      rows,
    };
    const output = process.env.CONTOURSTITCH_BENCHMARK_OUTPUT;
    if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.info(
      JSON.stringify(
        {
          host: report.host,
          engines: Object.fromEntries(
            methods.map((name) => [
              name,
              summary(rows.filter(({ engine }) => engine === name)),
            ]),
          ),
        },
        null,
        2,
      ),
    );
    expect(
      rows.filter(
        (row) =>
          row.engine === 'progressive' &&
          row.scenario === 'clean' &&
          row.predictedCm !== null,
      ),
    ).toHaveLength(9);
    expect(
      rows.filter(
        (row) =>
          row.engine === 'progressive' &&
          row.scenario === 'permanentCrop' &&
          row.predictedCm !== null,
      ),
    ).toHaveLength(0);
  },
  30_000,
);
