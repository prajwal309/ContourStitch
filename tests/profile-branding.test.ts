import { beforeEach, expect, it } from 'vitest';
import { deleteProfile, loadProfile, PROFILE_KEY, saveProfile } from '@/lib/storage/profile';
import { mockReport } from '@/lib/measurement/mock';

beforeEach(() => window.localStorage.clear());

it('preserves legacy profiles and removes the legacy entry when saving or deleting', () => {
  const legacyKey = 'fittingroom.profile.v1';
  const profile = { version: 1, unit: 'cm', report: mockReport() };
  window.localStorage.setItem(legacyKey, JSON.stringify(profile));
  expect(loadProfile()).toEqual(profile);
  saveProfile(profile.report, 'cm');
  expect(window.localStorage.getItem(legacyKey)).toBeNull();
  expect(window.localStorage.getItem(PROFILE_KEY)).not.toBeNull();
  window.localStorage.setItem(legacyKey, JSON.stringify(profile));
  deleteProfile();
  expect(window.localStorage.getItem(PROFILE_KEY)).toBeNull();
  expect(window.localStorage.getItem(legacyKey)).toBeNull();
});
