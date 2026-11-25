import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  changeConsent: vi.fn(),
  acceptMissing: vi.fn(() => []),
  revalidatePath: vi.fn(),
  withdraw: vi.fn(() => []),
}));

vi.mock('@/lib/auth/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/consent/store', () => ({
  acceptMissing: mocks.acceptMissing,
  changeConsent: mocks.changeConsent,
  withdraw: mocks.withdraw,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import {
  authorizeMeasurement,
  updateConsentPreference,
} from '@/lib/consent/actions';
import {
  agreements,
  accountAgreements,
  measurementAgreements,
  missingAgreements,
  checkedRegistrationVersions,
  validRegistrationVersions,
  registrationAgreements,
  type ConsentState,
} from '@/lib/consent/agreements';

const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
const acceptedAccount = Object.fromEntries(
  accountAgreements.map((type) => [
    type,
    {
      type,
      status: 'ACCEPTED',
      acceptedAt,
      revokedAt: null,
      agreementVersion: agreements[type].version,
    },
  ]),
) as ConsentState;

function cameraForm() {
  const form = new FormData();
  for (const type of measurementAgreements) {
    form.set(type, 'on');
    form.set(`version-${type}`, agreements[type].version);
  }
  return form;
}

describe('server consent checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue(null);
    mocks.changeConsent.mockImplementation(async (_, change) => {
      change(acceptedAccount);
      return true;
    });
  });

  it('requires the current policy before authorizing a guest', async () => {
    const form = cameraForm();
    form.delete('BODY_MEASUREMENT');
    expect(await authorizeMeasurement(null, {}, form)).toHaveProperty('error');
    form.set('BODY_MEASUREMENT', 'on');
    form.set('version-BODY_MEASUREMENT', 'previous');
    expect(await authorizeMeasurement(null, {}, form)).toHaveProperty('error');
    expect(await authorizeMeasurement(null, {}, cameraForm())).toEqual({
      saved: true,
    });
    expect(mocks.changeConsent).not.toHaveBeenCalled();
  });

  it('rejects unsigned requests and attempts to modify a different account', async () => {
    const form = new FormData();
    form.set('choice', 'revoke-improvement');
    expect(await updateConsentPreference('owner', {}, form)).toHaveProperty(
      'error',
    );
    mocks.currentUser.mockResolvedValue({ id: 'another-user' });
    expect(await updateConsentPreference('owner', {}, form)).toHaveProperty(
      'error',
    );
    expect(
      await authorizeMeasurement('owner', {}, cameraForm()),
    ).toHaveProperty('error');
    expect(mocks.changeConsent).not.toHaveBeenCalled();
  });

  it('rejects direct measurement starts without current account camera consent', async () => {
    mocks.currentUser.mockResolvedValue({ id: 'owner' });
    expect(
      await authorizeMeasurement('owner', {}, new FormData()),
    ).toHaveProperty('error');
    expect(mocks.acceptMissing).not.toHaveBeenCalled();
    expect(await authorizeMeasurement('owner', {}, cameraForm())).toEqual({
      saved: true,
    });
    expect(mocks.acceptMissing).toHaveBeenCalledWith(
      { ...acceptedAccount, BODY_MEASUREMENT: undefined },
      measurementAgreements,
    );
  });

  it('marks only outdated agreements as needing renewal', () => {
    expect(missingAgreements(acceptedAccount, accountAgreements)).toEqual([]);
    const state: ConsentState = {
      ...acceptedAccount,
      TERMS: { ...acceptedAccount.TERMS!, agreementVersion: 'previous' },
    };
    expect(missingAgreements(state, accountAgreements)).toEqual(['TERMS']);
  });
});

it('requires both registration choices and each current version without making improvement consent mandatory', () => {
  const form = new FormData();
  for (const type of registrationAgreements)
    form.set(`version-${type}`, agreements[type].version);
  expect(validRegistrationVersions(checkedRegistrationVersions(form))).toBe(
    false,
  );
  form.set('ACCOUNT', 'on');
  expect(validRegistrationVersions(checkedRegistrationVersions(form))).toBe(
    false,
  );
  form.set('BODY_MEASUREMENT', 'on');
  expect(validRegistrationVersions(checkedRegistrationVersions(form))).toBe(
    true,
  );
  form.set('version-BODY_MEASUREMENT', 'stale');
  expect(validRegistrationVersions(checkedRegistrationVersions(form))).toBe(
    false,
  );
});

it('does not grant the unified policy from legacy acceptance', () => {
  const state = Object.fromEntries(
    (['CAMERA', 'ACCURACY'] as const).map((type) => [
      type,
      {
        type,
        status: 'ACCEPTED',
        agreementVersion: agreements[type].version,
        acceptedAt,
        revokedAt: null,
      },
    ]),
  ) as ConsentState;
  expect(missingAgreements(state, measurementAgreements)).toEqual([
    'BODY_MEASUREMENT',
  ]);
});
