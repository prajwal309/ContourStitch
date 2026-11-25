export const progressiveMeasurementKeys = [
  'shoulder',
  'arm',
  'chest',
  'waist',
  'hip',
  'inseam',
  'torso',
  'neck',
  'sleeve',
] as const;

export type ProgressiveMeasurementKey =
  (typeof progressiveMeasurementKeys)[number];

type CohortRegression = {
  interceptCm: number;
  slope: number;
  residualSdCm: number;
};

type PriorRegression = {
  male: CohortRegression;
  female: CohortRegression;
};

const referenceHeightRangeCm = [150, 190] as const;

// OLS fits use the public ANSUR II male/female CSVs (measurements in mm,
// converted to cm). Cohorts are equally weighted because this app does not
// request sex. ANSUR II is a US military sample, not a civilian population.
// The landmark conventions correspond to the listed source dimensions:
// biacromial breadth, shoulder+forearm segment lengths, chest/waist/buttock
// circumferences, crotch height, acromial-to-iliocristale height, and neck
// circumference. Source and methods: https://www.openlab.psu.edu/datasets/ansur2/
const regressions: Record<
  Exclude<ProgressiveMeasurementKey, 'sleeve'>,
  PriorRegression
> = {
  shoulder: {
    male: { interceptCm: 15.463724, slope: 0.148637, residualSdCm: 1.623 },
    female: { interceptCm: 10.281607, slope: 0.161214, residualSdCm: 1.509 },
  },
  arm: {
    male: { interceptCm: -3.162621, slope: 0.377641, residualSdCm: 1.78 },
    female: { interceptCm: -4.905948, slope: 0.383603, residualSdCm: 1.755 },
  },
  chest: {
    male: { interceptCm: 50.45434, slope: 0.315544, residualSdCm: 8.473 },
    female: { interceptCm: 40.236553, slope: 0.334358, residualSdCm: 7.988 },
  },
  waist: {
    male: { interceptCm: 34.564483, slope: 0.338758, residualSdCm: 10.928 },
    female: { interceptCm: 28.001653, slope: 0.356708, residualSdCm: 9.73 },
  },
  hip: {
    male: { interceptCm: 35.233206, slope: 0.3799, residualSdCm: 7.213 },
    female: { interceptCm: 29.194034, slope: 0.447847, residualSdCm: 7.026 },
  },
  inseam: {
    male: { interceptCm: -17.631903, slope: 0.582075, residualSdCm: 2.388 },
    female: { interceptCm: -17.909559, slope: 0.590377, residualSdCm: 2.358 },
  },
  torso: {
    male: { interceptCm: 2.346672, slope: 0.202504, residualSdCm: 2.257 },
    female: { interceptCm: 6.11218, slope: 0.170865, residualSdCm: 2.021 },
  },
  neck: {
    male: { interceptCm: 26.878825, slope: 0.073374, residualSdCm: 2.528 },
    female: { interceptCm: 18.611252, slope: 0.088232, residualSdCm: 1.837 },
  },
};

export type AnthropometricPrior = {
  valueCm: number;
  standardDeviationCm: number;
  range95HalfWidthCm: number;
  source: 'ANSUR II height-conditioned prior';
};

export function anthropometricPrior(
  key: ProgressiveMeasurementKey,
  heightCm: number,
): AnthropometricPrior | null {
  if (
    !Number.isFinite(heightCm) ||
    heightCm < referenceHeightRangeCm[0] ||
    heightCm > referenceHeightRangeCm[1]
  )
    return null;

  const regression = regressions[key === 'sleeve' ? 'arm' : key];
  const maleMean =
    regression.male.interceptCm + regression.male.slope * heightCm;
  const femaleMean =
    regression.female.interceptCm + regression.female.slope * heightCm;
  const valueCm = (maleMean + femaleMean) / 2;
  const meanDifference = (maleMean - femaleMean) / 2;
  const standardDeviationCm = Math.sqrt(
    (regression.male.residualSdCm ** 2 +
      regression.female.residualSdCm ** 2) /
      2 +
      meanDifference ** 2,
  );

  return {
    valueCm,
    standardDeviationCm,
    range95HalfWidthCm: 1.96 * standardDeviationCm,
    source: 'ANSUR II height-conditioned prior',
  };
}
