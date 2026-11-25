'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { accountReturnPath } from '@/lib/auth/return-path';
import {
  accountAgreements,
  cameraAgreements,
  checkedVersions,
  matchesVersions,
  missingAgreements,
} from './agreements';
import {
  acceptMissing,
  changeConsent,
  hasAccountAgreements,
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
  const versions = checkedVersions(form, cameraAgreements);
  if (!user) {
    return matchesVersions(versions, cameraAgreements)
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
      const missing = missingAgreements(state, cameraAgreements);
      if (!matchesVersions(versions, missing)) {
        error = changedAgreements;
        return [];
      }
      return acceptMissing(state, cameraAgreements);
    });
    if (!saved) return changedSession;
  } catch {
    return saveError;
  }
  return error ? { error } : { saved: true };
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
    choice !== 'revoke-camera' &&
    choice !== 'allow-improvement'
  )
    return { error: 'Choose a valid consent preference.' };
  if (
    choice === 'allow-improvement' &&
    !matchesVersions(checkedVersions(form, ['IMPROVEMENT']), ['IMPROVEMENT'])
  )
    return { error: changedAgreements };

  try {
    let renewalNeeded = false;
    const saved = await changeConsent(user.id, (state) => {
      if (choice === 'revoke-camera') return withdraw(state, 'CAMERA');
      if (choice === 'revoke-improvement')
        return withdraw(state, 'IMPROVEMENT');
      if (missingAgreements(state, accountAgreements).length) {
        renewalNeeded = true;
        return [];
      }
      return acceptMissing(state, ['IMPROVEMENT']);
    });
    if (!saved) return changedSession;
    if (renewalNeeded)
      return {
        error: 'Review the current account agreements before opting in.',
      };
    revalidatePath('/account');
    revalidatePath('/measure');
    revalidatePath('/measure/experimental');
    return { saved: true };
  } catch {
    return saveError;
  }
}
