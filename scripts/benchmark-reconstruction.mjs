import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewCounts = new Set([4, 8, 16, 32, 64]);
const engines = new Set(['baseline', 'parametric', 'visual-hull']);

function validate(rows) {
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error(
      'Provide a non-empty JSON array of de-identified benchmark records.',
    );
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw new Error(`Record ${index + 1} must be an object.`);
    const valid =
      typeof row.id === 'string' &&
      engines.has(row.engine) &&
      typeof row.key === 'string' &&
      Number.isFinite(row.referenceCm) &&
      (row.predictedCm === null || Number.isFinite(row.predictedCm)) &&
      (row.uncertaintyCm === null ||
        (Number.isFinite(row.uncertaintyCm) && row.uncertaintyCm >= 0)) &&
      (row.latencyMs === null ||
        (Number.isFinite(row.latencyMs) && row.latencyMs >= 0)) &&
      typeof row.failed === 'boolean' &&
      (row.viewCount === undefined || viewCounts.has(row.viewCount));
    if (!valid)
      throw new Error(
        `Record ${index + 1} does not match the benchmark schema.`,
      );
    return row;
  });
}

function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = [row.engine, row.key, row.viewCount ?? 'all'].join('|');
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return [...groups.values()]
    .map((group) => {
      const valid = group.filter(
        (row) => !row.failed && row.predictedCm !== null,
      );
      const errors = valid.map((row) => row.predictedCm - row.referenceCm);
      const sortedAbsoluteErrors = errors.map(Math.abs).sort((a, b) => a - b);
      const latencies = group
        .map((row) => row.latencyMs)
        .filter((value) => value !== null);
      const intervals = valid.filter((row) => row.uncertaintyCm !== null);
      const first = group[0];
      return {
        engine: first.engine,
        key: first.key,
        viewCount: first.viewCount ?? null,
        sampleCount: group.length,
        failureRate:
          group.filter((row) => row.failed || row.predictedCm === null).length /
          group.length,
        biasCm: mean(errors),
        maeCm: mean(errors.map(Math.abs)),
        rmseCm:
          errors.length === 0
            ? null
            : Math.sqrt(mean(errors.map((error) => error ** 2))),
        percentile95AbsoluteErrorCm:
          sortedAbsoluteErrors.length === 0
            ? null
            : sortedAbsoluteErrors[
                Math.ceil(sortedAbsoluteErrors.length * 0.95) - 1
              ],
        meanLatencyMs: mean(latencies),
        uncertaintyCoverage:
          intervals.length === 0
            ? null
            : intervals.filter(
                (row) =>
                  Math.abs(row.predictedCm - row.referenceCm) <=
                  row.uncertaintyCm,
              ).length / intervals.length,
      };
    })
    .sort(
      (a, b) =>
        a.engine.localeCompare(b.engine) ||
        a.key.localeCompare(b.key) ||
        (a.viewCount ?? 0) - (b.viewCount ?? 0),
    );
}

function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function svgChart(metrics, metric, title, suffix) {
  const rows = metrics.filter((row) => row[metric] !== null);
  if (!rows.length)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="120" viewBox="0 0 900 120"><rect width="100%" height="100%" fill="#fbf8f2"/><text x="20" y="38" font-family="sans-serif" font-size="20" font-weight="700">${escapeXml(title)}</text><text x="20" y="78" font-family="sans-serif" font-size="15">No values available in the supplied dataset.</text></svg>`;
  const width = 1100;
  const rowHeight = 34;
  const height = 88 + rowHeight * rows.length;
  const labelWidth = 390;
  const chartWidth = width - labelWidth - 80;
  const maximum = Math.max(...rows.map((row) => row[metric]), 0.001);
  const bars = rows
    .map((row, index) => {
      const y = 64 + index * rowHeight;
      const value = row[metric];
      const barWidth = (value / maximum) * chartWidth;
      const displayedValue = suffix === '%' ? value * 100 : value;
      const label = `${row.engine} · ${row.key}${row.viewCount ? ` · ${row.viewCount} views` : ''}`;
      return `<text x="20" y="${y + 16}" font-size="14">${escapeXml(label)}</text><rect x="${labelWidth}" y="${y}" width="${barWidth.toFixed(2)}" height="22" rx="4" fill="#795b3f"/><text x="${labelWidth + barWidth + 8}" y="${y + 16}" font-size="13">${displayedValue.toFixed(1)}${suffix}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbf8f2"/><text x="20" y="34" font-family="sans-serif" font-size="20" font-weight="700">${escapeXml(title)}</text>${bars}</svg>`;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      'Usage: node scripts/benchmark-reconstruction.mjs records.json',
    );
    process.exitCode = 2;
    return;
  }
  const rows = validate(
    JSON.parse(await readFile(path.resolve(inputPath), 'utf8')),
  );
  const metrics = summarize(rows);
  const figuresDir = path.join(root, 'Figures');
  await mkdir(figuresDir, { recursive: true });
  const charts = [
    ['benchmark-mae.svg', 'maeCm', 'Mean absolute error (cm)', ' cm'],
    [
      'benchmark-p95-error.svg',
      'percentile95AbsoluteErrorCm',
      '95th percentile absolute error (cm)',
      ' cm',
    ],
    ['benchmark-failure-rate.svg', 'failureRate', 'Failure rate', '%'],
    [
      'benchmark-interval-coverage.svg',
      'uncertaintyCoverage',
      'Empirical uncertainty interval coverage',
      '%',
    ],
  ];
  for (const [filename, metric, title, suffix] of charts) {
    const svg = svgChart(metrics, metric, title, suffix);
    await writeFile(path.join(figuresDir, filename), svg);
  }
  console.log(JSON.stringify({ records: rows.length, metrics }, null, 2));
  console.log(`Figures written to ${figuresDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Benchmark failed.');
  process.exitCode = 1;
});
