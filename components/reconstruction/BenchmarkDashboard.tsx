'use client';

import { useState } from 'react';
import { summarizeBenchmarks } from '@/lib/reconstruction/benchmark';
import type {
  BenchmarkCase,
  BenchmarkMetric,
  MeasurementEngineId,
} from '@/lib/reconstruction/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEngineId(value: unknown): value is MeasurementEngineId {
  return (
    value === 'baseline' || value === 'parametric' || value === 'visual-hull'
  );
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return (
    value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

function isViewCount(value: unknown): value is 4 | 8 | 16 | 32 | 64 {
  return (
    value === 4 || value === 8 || value === 16 || value === 32 || value === 64
  );
}

function parseCases(value: unknown): BenchmarkCase[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array.');
  return value.map((item, index) => {
    if (!isRecord(item))
      throw new Error(`Record ${index + 1} is not an object.`);
    if (
      typeof item.id !== 'string' ||
      !isEngineId(item.engine) ||
      typeof item.key !== 'string' ||
      typeof item.referenceCm !== 'number' ||
      !Number.isFinite(item.referenceCm) ||
      (item.viewCount !== undefined && !isViewCount(item.viewCount)) ||
      !isNullableFiniteNumber(item.predictedCm) ||
      !isNullableFiniteNumber(item.uncertaintyCm) ||
      !isNullableFiniteNumber(item.latencyMs) ||
      typeof item.failed !== 'boolean'
    )
      throw new Error(
        `Record ${index + 1} does not match the benchmark schema.`,
      );
    return {
      id: item.id,
      engine: item.engine,
      key: item.key,
      ...(item.viewCount === undefined ? {} : { viewCount: item.viewCount }),
      predictedCm: item.predictedCm,
      referenceCm: item.referenceCm,
      uncertaintyCm: item.uncertaintyCm,
      latencyMs: item.latencyMs,
      failed: item.failed,
    };
  });
}

function show(value: number | null, digits = 2) {
  return value === null ? '—' : value.toFixed(digits);
}

export function BenchmarkDashboard() {
  const [metrics, setMetrics] = useState<BenchmarkMetric[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > 2_000_000)
        throw new Error('Validation file must be smaller than 2 MB.');
      const cases = parseCases(JSON.parse(await file.text()));
      setMetrics(summarizeBenchmarks(cases));
      setRecordCount(cases.length);
    } catch (reason) {
      setMetrics([]);
      setRecordCount(0);
      setError(
        reason instanceof Error ? reason.message : 'Could not read dataset.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="benchmark-dashboard" aria-labelledby="benchmark-title">
      <p className="eyebrow">LOCAL ANALYSIS ONLY</p>
      <h2 id="benchmark-title">Validation comparison dashboard</h2>
      <p>
        Load de-identified benchmark records to compare error, failure rate,
        latency, and empirical interval coverage. The file is parsed in this
        browser only and is not saved or uploaded.
      </p>
      <label className="benchmark-upload">
        Benchmark JSON
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => void loadFile(event.currentTarget.files?.[0])}
        />
      </label>
      {busy && <p role="status">Calculating metrics…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!recordCount && !busy && !error && (
        <p className="muted">
          No benchmark records loaded; no performance results are available.
        </p>
      )}
      {recordCount > 0 && (
        <>
          <p role="status">{recordCount} records analyzed in this browser.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Engine / measure</th>
                  <th scope="col">Views</th>
                  <th scope="col">N</th>
                  <th scope="col">Failure</th>
                  <th scope="col">Bias (cm)</th>
                  <th scope="col">MAE (cm)</th>
                  <th scope="col">RMSE (cm)</th>
                  <th scope="col">P95 abs. error (cm)</th>
                  <th scope="col">Latency (ms)</th>
                  <th scope="col">Interval coverage</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={`${metric.engine}-${metric.key}`}>
                    <th scope="row">
                      {metric.engine} / {metric.key}
                    </th>
                    <td>{metric.viewCount ?? '—'}</td>
                    <td>{metric.sampleCount}</td>
                    <td>{show(metric.failureRate * 100, 1)}%</td>
                    <td>{show(metric.biasCm)}</td>
                    <td>{show(metric.maeCm)}</td>
                    <td>{show(metric.rmseCm)}</td>
                    <td>{show(metric.percentile95AbsoluteErrorCm)}</td>
                    <td>{show(metric.meanLatencyMs, 1)}</td>
                    <td>
                      {metric.uncertaintyCoverage === null
                        ? '—'
                        : `${show(metric.uncertaintyCoverage * 100, 1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>MAE by engine and measure</h3>
          <div
            className="benchmark-bars"
            role="img"
            aria-label="Mean absolute error comparison"
          >
            {metrics.map((metric) => (
              <div
                className="benchmark-bar-row"
                key={`${metric.engine}-${metric.key}-bar`}
              >
                <span>
                  {metric.engine} · {metric.key}
                  {metric.viewCount ? ` · ${metric.viewCount} views` : ''}
                </span>
                {metric.maeCm === null ? (
                  <span>No successful estimates</span>
                ) : (
                  <>
                    <meter
                      min={0}
                      max={Math.max(
                        ...metrics.map((item) => item.maeCm ?? 0),
                        1,
                      )}
                      value={metric.maeCm}
                      aria-label={`${metric.engine} ${metric.key} MAE`}
                    />
                    <span>{show(metric.maeCm)} cm</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="muted">
            Metrics describe only the supplied dataset. No benchmark or
            validation result is included by default.
          </p>
        </>
      )}
    </section>
  );
}
