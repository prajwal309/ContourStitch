import { describe, expect, it } from 'vitest';
import {
  compatibility,
  fitProgress,
  readExtraMeasurements,
} from '@/lib/shop/fit';
import {
  filterCatalog,
  getProduct,
  measurementDefinition,
} from '@/lib/shop/catalog';
import { accountReturnPath } from '@/lib/auth/return-path';

describe('outfit fit requirements', () => {
  it('reuses the same body data across outfits and distinguishes missing garment and body dimensions', () => {
    const measured = ['chest', 'waist', 'hip', 'shoulder', 'sleeve'] as const;
    expect(
      compatibility(getProduct('heritage-kurta')!.requirements, measured)
        .missing,
    ).toEqual(['kurtaLength']);
    expect(
      compatibility(getProduct('heritage-lehenga')!.requirements, measured)
        .missing,
    ).toEqual(['bust', 'skirtLength']);
    expect(measurementDefinition('bust').kind).toBe('body');
    expect(measurementDefinition('kurtaLength').kind).toBe('garment');
  });

  it('accepts only required extras and preserves incomplete selections', () => {
    const product = getProduct('heritage-kurta')!;
    const measured = ['chest', 'waist', 'shoulder', 'sleeve'] as const;
    const form = new FormData();
    form.set('extra-chest', '1');
    form.set('extra-bust', '106');
    expect(readExtraMeasurements(product, measured, form)).toEqual({
      values: {},
      complete: false,
      usesProfile: true,
    });
    form.set('extra-kurtaLength', '112.5');
    expect(readExtraMeasurements(product, measured, form)).toEqual({
      values: { kurtaLength: 112.5 },
      complete: true,
      usesProfile: true,
    });
    form.set('extra-kurtaLength', '301');
    expect(readExtraMeasurements(product, measured, form)).toBeNull();
  });

  it('marks the selection incomplete when its fit revision is removed', () => {
    expect(
      fitProgress({
        fitComplete: true,
        usesProfile: true,
        fitRevisionId: null,
      }),
    ).toBe('Fit details pending');
    expect(
      fitProgress({
        fitComplete: true,
        usesProfile: false,
        fitRevisionId: null,
      }),
    ).toBe('Fit details entered');
  });

  it('filters catalog facets in combination and rejects external sign-in destinations', () => {
    expect(
      filterCatalog({
        type: 'Kurta',
        age: 'Children',
        color: 'Copper',
        occasion: 'Wedding',
        style: 'Classic',
      }).products.map(({ key }) => key),
    ).toEqual(['junior-kurta']);
    expect(accountReturnPath('/family-fit/invite')).toBe('/family-fit/invite');
    expect(accountReturnPath('//other.example/family-fit')).toBe(
      '/my-measurements',
    );
    expect(accountReturnPath('/shop/../account')).toBe('/my-measurements');
  });
});
