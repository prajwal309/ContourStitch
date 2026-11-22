import type { MeasurementKey } from '@/lib/measurement/types';
import type { Product, RequiredMeasurement } from './catalog';

export const preferences = ['Regular', 'Closer', 'Relaxed'] as const;

// Compatibility counts recorded dimensions. Garment ease and sizing remain separate.
export function compatibility(
  requirements: readonly RequiredMeasurement[],
  keys: readonly MeasurementKey[],
) {
  const supported = new Set<RequiredMeasurement>(keys);
  return {
    fromProfile: requirements.filter((key) => supported.has(key)),
    missing: requirements.filter((key) => !supported.has(key)),
  };
}

export function readExtraMeasurements(
  product: Product,
  available: readonly MeasurementKey[],
  form: FormData,
) {
  const { missing, fromProfile } = compatibility(
    product.requirements,
    available,
  );
  const values: Partial<Record<RequiredMeasurement, number>> = {};

  for (const key of missing) {
    const input = form.get(`extra-${key}`);
    if (input === null || input === '') continue;
    if (
      typeof input !== 'string' ||
      !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(input.trim())
    )
      return null;
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0 || value > 300) return null;
    values[key] = value;
  }

  return {
    values,
    complete: missing.every((key) => values[key] !== undefined),
    usesProfile: fromProfile.length > 0,
  };
}

export function fitProgress(selection: {
  fitComplete: boolean;
  usesProfile: boolean;
  fitRevisionId: string | null;
}) {
  return selection.fitComplete &&
    (!selection.usesProfile || selection.fitRevisionId !== null)
    ? 'Fit details entered'
    : 'Fit details pending';
}
