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
  cameraAgreements,
  missingAgreements,
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
  for (const type of cameraAgreements) {
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

  it('requires both current agreements before authorizing a guest', async () => {
    const form = cameraForm();
    form.delete('ACCURACY');
    expect(await authorizeMeasurement(null, {}, form)).toHaveProperty('error');
    form.set('ACCURACY', 'on');
    form.set('version-ACCURACY', 'previous');
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
      acceptedAccount,
      cameraAgreements,
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
