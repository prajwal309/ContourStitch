import { readFile } from 'node:fs/promises';

const fields = [
  'height',
  'shoulder',
  'chest',
  'waist',
  'hip',
  'sleeve',
  'inseam',
  'outseam',
  'arm',
  'neck',
];
const strata = ['device', 'clothing', 'cameraAngle'];
const [file, option] = process.argv.slice(2);
const group = option?.startsWith('--by=') ? option.slice(5) : '';

if (!file || (option && !strata.includes(group))) {
  process.stderr.write(
    'Usage: node scripts/validate-measurements.mjs FILE [--by=device|clothing|cameraAngle]\n',
  );
  process.exit(1);
}

const records = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(records))
  throw new Error('Expected an array of de-identified records.');

function metrics(rows) {
  const result = {};
  const mean = (values) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  for (const key of fields) {
    const eligibility = rows.filter((row) =>
      Number.isFinite(row?.referenceCm?.[key]),
    );
    if (!eligibility.length) continue;

    const errors = eligibility.flatMap((row) =>
      Number.isFinite(row.predictedCm?.[key])
        ? [row.predictedCm[key] - row.referenceCm[key]]
        : [],
    );
    const absolute = errors.map(Math.abs).sort((a, b) => a - b);
    result[key] = {
      count: errors.length,
      referenceCount: eligibility.length,
      coverage: errors.length / eligibility.length,
      bias: errors.length ? mean(errors) : null,
      mae: errors.length ? mean(absolute) : null,
      rmse: errors.length
        ? Math.sqrt(mean(errors.map((value) => value ** 2)))
        : null,
      p95AbsoluteError: errors.length
        ? absolute[Math.ceil(0.95 * absolute.length) - 1]
        : null,
    };
  }
  return result;
}

const overall = metrics(records);
const output = group ? { overall } : overall;
if (group) {
  const groups = Map.groupBy(
    records,
    (row) => row?.conditions?.[group] ?? 'unspecified',
  );
  for (const label of groups.keys()) {
    if (typeof label !== 'string' || !/^[a-z0-9 -]{1,40}$/i.test(label)) {
      throw new Error('Condition labels must be short, coarse descriptions.');
    }
  }
  output[group] = Object.fromEntries(
    [...groups].map(([label, rows]) => [label, metrics(rows)]),
  );
}
// Aggregate output only.
console.log(JSON.stringify(output, null, 2));
