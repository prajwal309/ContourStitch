import { readFile } from 'node:fs/promises';
const records = JSON.parse(await readFile(process.argv[2], 'utf8'));
const keys = [
  'height',
  'shoulder',
  'chest',
  'waist',
  'hip',
  'sleeve',
  'inseam',
  'outseam',
];
const result = {};
for (const key of keys) {
  const errors = records.flatMap((r) =>
    Number.isFinite(r.predictedCm?.[key]) &&
    Number.isFinite(r.referenceCm?.[key])
      ? [r.predictedCm[key] - r.referenceCm[key]]
      : [],
  );
  if (!errors.length) continue;
  const absolute = errors.map(Math.abs).sort((a, b) => a - b);
  const mean = (values) =>
    values.reduce((sum, v) => sum + v, 0) / values.length;
  result[key] = {
    count: errors.length,
    bias: mean(errors),
    mae: mean(absolute),
    rmse: Math.sqrt(mean(errors.map((v) => v * v))),
    p95AbsoluteError: absolute[Math.ceil(0.95 * absolute.length) - 1],
  };
}
// Aggregate output only. No anonymous IDs or individual measurements are logged.
console.log(JSON.stringify(result, null, 2));
