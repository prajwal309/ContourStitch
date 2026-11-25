'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { accountReturnPath } from '@/lib/auth/return-path';
import {
  accountAgreements,
  measurementAgreements,
  checkedVersions,
  matchesVersions,
  missingAgreements,
} from './agreements';
import {
  acceptMissing,
  changeConsent,
  hasAccountAgreements,
  readConsent,
  withdraw,
} from './store';

export type AgreementActionState = { error?: string; saved?: boolean };

const changedSession = {
  error: 'Your sign-in changed. Reload this page to continue.',
};
const changedAgreements =
  'Review and accept the current agreements to continue. Reload this page if the documents have changed.';
const saveError = {
  error: 'Your choices could not be saved. Please try again.',
};

export async function acceptAccountAgreements(
  expectedUserId: string,
  next: string,
  _: AgreementActionState,
  form: FormData,
): Promise<AgreementActionState> {
  const user = await currentUser();
  if (user?.id !== expectedUserId) return changedSession;
  try {
    const saved = await changeConsent(user.id, (state) => {
      const missing = missingAgreements(state, accountAgreements);
      if (!matchesVersions(checkedVersions(form, accountAgreements), missing))
        return [];
      return acceptMissing(state, accountAgreements);
    });
    if (!saved) return changedSession;
    // A stale or incomplete form must never skip the review.
    if (!(await hasAccountAgreements(user.id)))
      return { error: changedAgreements };
  } catch {
    return saveError;
  }
  redirect(accountReturnPath(next));
}

export async function authorizeMeasurement(
  expectedUserId: string | null,
  _: AgreementActionState,
  form: FormData,
): Promise<AgreementActionState> {
  const user = await currentUser();
  if ((user?.id ?? null) !== expectedUserId) return changedSession;
  const versions = checkedVersions(form, measurementAgreements);
  if (!user) {
    return matchesVersions(versions, measurementAgreements)
      ? { saved: true }
      : { error: changedAgreements };
  }
  let error: string | undefined;
  try {
    const saved = await changeConsent(user.id, (state) => {
      if (missingAgreements(state, accountAgreements).length) {
        error =
          'Review the current account agreements before starting. Reload this page to continue.';
        return [];
      }
      if (!matchesVersions(versions, measurementAgreements)) {
        error = changedAgreements;
        return [];
      }
      return acceptMissing(
        { ...state, BODY_MEASUREMENT: undefined },
        measurementAgreements,
      );
    });
    if (!saved) return changedSession;
  } catch {
    return saveError;
  }
  return error ? { error } : { saved: true };
}

export async function recheckMeasurementAccess(
  expectedUserId: string,
): Promise<AgreementActionState> {
  const user = await currentUser();
  if (!user || user.id !== expectedUserId) return changedSession;
  try {
    const state = await readConsent(user.id);
    return missingAgreements(state, [
      ...accountAgreements,
      ...measurementAgreements,
    ]).length
      ? { error: changedAgreements }
      : { saved: true };
  } catch {
    return saveError;
  }
}

export async function updateConsentPreference(
  expectedUserId: string,
  _: AgreementActionState,
  form: FormData,
): Promise<AgreementActionState> {
  const user = await currentUser();
  if (user?.id !== expectedUserId) return changedSession;
  const choice = form.get('choice');
  if (
    choice !== 'revoke-improvement' &&
    choice !== 'revoke-body-measurement' &&
    choice !== 'allow-body-measurement' &&
    choice !== 'allow-improvement'
  )
    return { error: 'Choose a valid consent preference.' };
  const requested =
    choice === 'allow-body-measurement'
      ? 'BODY_MEASUREMENT'
      : choice === 'allow-improvement'
        ? 'IMPROVEMENT'
        : null;
  if (
    requested &&
    !matchesVersions(checkedVersions(form, [requested]), [requested])
  )
    return { error: changedAgreements };

  try {
    let renewalNeeded = false;
    const saved = await changeConsent(user.id, (state) => {
      if (choice === 'revoke-body-measurement')
        return withdraw(state, 'BODY_MEASUREMENT');
      if (choice === 'revoke-improvement')
        return withdraw(state, 'IMPROVEMENT');
      if (missingAgreements(state, accountAgreements).length) {
        renewalNeeded = true;
        return [];
      }
      return requested ? acceptMissing(state, [requested]) : [];
    });
    if (!saved) return changedSession;
    if (renewalNeeded)
      return {
        error:
          requested === 'BODY_MEASUREMENT'
            ? 'Review the current account agreements before saving measurement consent.'
            : 'Review the current account agreements before opting in.',
      };
    revalidatePath('/account');
    revalidatePath('/measure');
    revalidatePath('/measure/experimental');
    return { saved: true };
  } catch {
    return saveError;
  }
}
