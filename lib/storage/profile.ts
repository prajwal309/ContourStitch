import {
  measurementKeys,
  type MeasurementReport,
  type MeasurementEstimate,
  type Unit,
} from '@/lib/measurement/types';
import { tapeMethod } from '@/lib/measurement/corrections';

export const PROFILE_KEY = 'contourstitch.profile.v1';
const LEGACY_PROFILE_KEY = 'fittingroom.profile.v1';
export type LocalProfile = {
  version: 1;
  unit: Unit;
  report: MeasurementReport;
};

const validCm = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 300;

function sanitizeEstimates(input: unknown): MeasurementEstimate[] | null {
  if (!Array.isArray(input) || input.length > measurementKeys.length)
    return null;

  const estimates: MeasurementEstimate[] = [];
  for (const item of input) {
    if (
      !item ||
      !measurementKeys.includes(item.key) ||
      estimates.some((estimate) => estimate.key === item.key) ||
      !validCm(item.valueCm) ||
      (item.uncertaintyCm !== null &&
        (!Number.isFinite(item.uncertaintyCm) ||
          item.uncertaintyCm < 0 ||
          item.uncertaintyCm > 300)) ||
      !['low', 'medium', 'high'].includes(item.confidence) ||
      typeof item.method !== 'string' ||
      item.method.length > 500 ||
      !Array.isArray(item.warnings) ||
      item.warnings.some(
        (warning: unknown) =>
          typeof warning !== 'string' || warning.length > 500,
      )
    )
      return null;

    const sides = item.sidesCm;
    if (
      sides !== undefined &&
      (!sides || !validCm(sides.left) || !validCm(sides.right))
    )
      return null;

    estimates.push({
      ...(sides && { sidesCm: { left: sides.left, right: sides.right } }),
      key: item.key,
      valueCm: item.valueCm,
      uncertaintyCm: item.uncertaintyCm,
      confidence: item.confidence,
      method: item.method,
      warnings: [...item.warnings],
    });
  }

  return estimates;
}

/** Reconstruct the profile from the supported measurement fields. */
export function sanitizeProfile(input: unknown): LocalProfile | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<LocalProfile>;
  if (
    value.version !== 1 ||
    (value.unit !== 'cm' && value.unit !== 'in') ||
    !value.report
  )
    return null;

  const estimates = sanitizeEstimates(value.report.estimates);
  if (!estimates) return null;

  const originalEstimates = sanitizeEstimates(
    value.report.originalEstimates ?? [],
  );
  if (
    !originalEstimates ||
    originalEstimates.some(
      (original) =>
        original.method === tapeMethod ||
        !estimates.some(
          (estimate) =>
            estimate.key === original.key && estimate.method === tapeMethod,
        ),
    )
  )
    return null;

  const missing: MeasurementReport['missing'] = {};
  for (const key of measurementKeys) {
    const reason = value.report.missing?.[key];
    if (typeof reason === 'string' && reason.length <= 500)
      missing[key] = reason;
  }

  return {
    version: 1,
    unit: value.unit,
    report: {
      ...((value.report.source === 'live-video' ||
        value.report.source === 'progressive-video') && {
        source: value.report.source,
      }),
      estimates,
      missing,
      ...(originalEstimates.length && { originalEstimates }),
    },
  };
}

export function saveProfile(report: MeasurementReport, unit: Unit) {
  const profile = sanitizeProfile({ version: 1, report, unit });
  if (!profile) throw new Error('Invalid measurements');
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.localStorage.removeItem(LEGACY_PROFILE_KEY);
}

export function loadProfile(): LocalProfile | null {
  const stored =
    window.localStorage.getItem(PROFILE_KEY) ??
    window.localStorage.getItem(LEGACY_PROFILE_KEY);
  if (!stored) return null;
  try {
    return sanitizeProfile(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function deleteProfile() {
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(LEGACY_PROFILE_KEY);
}
