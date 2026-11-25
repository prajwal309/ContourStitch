import 'server-only';

import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { agreementReviewPath, signInFor } from '@/lib/auth/return-path';
import {
  accountAgreements,
  measurementAgreementsToConfirm,
  missingAgreements,
} from './agreements';
import { hasAccountAgreements, readConsent } from './store';

export async function requireAgreedAccount(path: string) {
  const user = await currentUser();
  if (!user) redirect(signInFor(path));
  if (!(await hasAccountAgreements(user.id)))
    redirect(agreementReviewPath(path));
  return user;
}

export async function measurementAccess(path: string) {
  const user = await currentUser();
  const state = user ? await readConsent(user.id) : {};
  if (user && missingAgreements(state, accountAgreements).length)
    redirect(agreementReviewPath(path));
  return {
    userId: user?.id ?? null,
    required: measurementAgreementsToConfirm(state),
  };
}
