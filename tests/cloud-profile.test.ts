import { describe, expect, it } from 'vitest';
import { mockReport } from '@/lib/measurement/mock';
import { correctMeasurement } from '@/lib/measurement/corrections';
import { prepareProfile, restoreProfile } from '@/lib/accounts/profile-data';

describe('cloud profile payload', () => {
  it('keeps the original estimate and uncertainty alongside a tape correction', () => {
    const original = mockReport();
    const edited = correctMeasurement(
      correctMeasurement(original, 'waist', 82),
      'waist',
      83,
    );
    const stored = prepareProfile({
      version: 1,
      unit: 'in',
      report: edited,
      photo: 'discarded',
    });
    expect(stored).not.toBeNull();
    expect(stored?.corrections).toEqual({ waist: 83 });
    expect(stored?.unit).toBe('in');
    expect(
      stored?.observations.find(({ key }) => key === 'waist'),
    ).toMatchObject({
      key: 'waist',
      valueCm: 83,
      uncertaintyCm: null,
      method: 'Manually entered tape measurement',
    });
    expect(stored?.estimates.find(({ key }) => key === 'waist')).toEqual(
      original.estimates.find(({ key }) => key === 'waist'),
    );
    expect(stored).not.toHaveProperty('photo');
    expect(restoreProfile(stored!)?.report.originalEstimates).toEqual(
      edited.originalEstimates,
    );
  });

  it('deduplicates values across unit choices, while detecting numerical changes', () => {
    const report = mockReport();
    const metric = prepareProfile({ version: 1, unit: 'cm', report });
    const imperial = prepareProfile({
      version: 1,
      unit: 'in',
      report: { ...report, estimates: [...report.estimates].reverse() },
    });
    const corrected = prepareProfile({
      version: 1,
      unit: 'cm',
      report: correctMeasurement(report, 'waist', 83),
    });
    expect(imperial?.fingerprint).toBe(metric?.fingerprint);
    expect(corrected?.fingerprint).not.toBe(metric?.fingerprint);
  });

  it('rejects empty and invalid profiles', () => {
    expect(
      prepareProfile({ version: 1, unit: 'cm', report: { estimates: [] } }),
    ).toBeNull();
    expect(
      prepareProfile({
        version: 1,
        unit: 'cm',
        report: correctMeasurement(mockReport(), 'waist', 0),
      }),
    ).toBeNull();
  });
});
