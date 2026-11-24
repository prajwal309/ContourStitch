import type { BenchmarkCase, BenchmarkMetric } from './types';

const viewCounts = [4, 8, 16, 32, 64] as const;

function isViewCount(value: number): value is (typeof viewCounts)[number] {
  return viewCounts.some((count) => count === value);
}

export function summarizeBenchmarks(
  cases: readonly BenchmarkCase[],
): BenchmarkMetric[] {
  const groups = new Map<string, BenchmarkCase[]>();
  for (const item of cases) {
    if (
      !item.id ||
      !item.key ||
      !Number.isFinite(item.referenceCm) ||
      (item.predictedCm !== null && !Number.isFinite(item.predictedCm)) ||
      (item.uncertaintyCm !== null &&
        (!Number.isFinite(item.uncertaintyCm) || item.uncertaintyCm < 0)) ||
      (item.latencyMs !== null &&
        (!Number.isFinite(item.latencyMs) || item.latencyMs < 0)) ||
      (item.viewCount !== undefined && !isViewCount(item.viewCount))
    )
      throw new Error(`Invalid benchmark case: ${item.id || '(missing id)'}`);
    const group = `${item.engine}\0${item.key}\0${item.viewCount ?? ''}`;
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([, values]) => {
      const sample = values[0];
      const valid = values.filter(
        (value): value is BenchmarkCase & { predictedCm: number } =>
          !value.failed && value.predictedCm !== null,
      );
      const errors = valid.map(
        (value) => value.predictedCm - value.referenceCm,
      );
      const sortedAbsoluteErrors = errors.map(Math.abs).sort((a, b) => a - b);
      const latency = values
        .map((value) => value.latencyMs)
        .filter((value): value is number => value !== null);
      const uncertainty = valid.filter(
        (value): value is typeof value & { uncertaintyCm: number } =>
          value.uncertaintyCm !== null,
      );
      return {
        engine: sample.engine,
        key: sample.key,
        viewCount: sample.viewCount ?? null,
        sampleCount: values.length,
        failureRate:
          values.filter((value) => value.failed || value.predictedCm === null)
            .length / values.length,
        biasCm:
          errors.length > 0
            ? errors.reduce((sum, error) => sum + error, 0) / errors.length
            : null,
        maeCm:
          errors.length > 0
            ? errors.reduce((sum, error) => sum + Math.abs(error), 0) /
              errors.length
            : null,
        rmseCm:
          errors.length > 0
            ? Math.sqrt(
                errors.reduce((sum, error) => sum + error ** 2, 0) /
                  errors.length,
              )
            : null,
        percentile95AbsoluteErrorCm:
          sortedAbsoluteErrors.length > 0
            ? sortedAbsoluteErrors[
                Math.ceil(sortedAbsoluteErrors.length * 0.95) - 1
              ]
            : null,
        meanLatencyMs:
          latency.length > 0
            ? latency.reduce((sum, value) => sum + value, 0) / latency.length
            : null,
        uncertaintyCoverage:
          uncertainty.length > 0
            ? uncertainty.filter(
                (value) =>
                  Math.abs(value.predictedCm - value.referenceCm) <=
                  value.uncertaintyCm,
              ).length / uncertainty.length
            : null,
      };
    })
    .sort(
      (a, b) =>
        a.engine.localeCompare(b.engine) ||
        a.key.localeCompare(b.key) ||
        (a.viewCount ?? 0) - (b.viewCount ?? 0),
    );
}
