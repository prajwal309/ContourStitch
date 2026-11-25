'use server';

import { Prisma } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  checkedVersions,
  matchesVersions,
  registrationAgreements,
  validRegistrationVersions,
} from '@/lib/consent/agreements';
import { registrationEvents } from '@/lib/consent/store';
import { accountSignInEnabled, currentUser } from './auth';
import { database } from './db';
import { oauthIntentCookie } from './oauth-intent';
import {
  hashPassword,
  parseUsername,
  validPassword,
  verifyPassword,
} from './password';
import { allowPasswordAttempt } from './password-limits';
import { agreementReviewPath } from './return-path';
import { newSession, sessionToken, writeSessionCookie } from './sessions';

export type PasswordFeedback = { error?: string };

const unavailable = {
  error: 'Account access is temporarily unavailable. Please try again.',
};
const invalidCredentials = {
  error: 'Check your username and password and try again.',
};
const throttled = {
  error: 'Too many attempts. Wait a few minutes and try again.',
};

export async function submitPassword(
  mode: 'register' | 'sign-in',
  nextPath: string,
  _previous: PasswordFeedback,
  form: FormData,
): Promise<PasswordFeedback> {
  if (!accountSignInEnabled) return unavailable;
  if (mode !== 'register' && mode !== 'sign-in') return unavailable;

  const username = parseUsername(form.get('username'));
  const password = form.get('password');
  const register = mode === 'register';
  if (!username || !validPassword(password)) {
    return register
      ? {
          error:
            'Enter a valid username and a password of 15 to 128 characters.',
        }
      : invalidCredentials;
  }
  if (register && form.get('confirm-password') !== password) {
    return { error: 'The passwords do not match.' };
  }

  const versions = checkedVersions(form, [
    ...registrationAgreements,
    'IMPROVEMENT',
  ]);
  if (
    register &&
    (!validRegistrationVersions(versions) ||
      (form.has('IMPROVEMENT') && !matchesVersions(versions, ['IMPROVEMENT'])))
  )
    return { error: 'Review and accept the current required agreements.' };

  const session = newSession();
  try {
    if (await currentUser())
      return {
        error: 'You are already signed in. Refresh this page to continue.',
      };
    if (!(await allowPasswordAttempt(mode, username))) return throttled;

    const db = database();
    const oldToken = await sessionToken();
    if (register) {
      const passwordHash = await hashPassword(password);
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            passwordLogin: { create: { username, passwordHash } },
            consentEvents: {
              create: registrationEvents(
                matchesVersions(versions, ['IMPROVEMENT']),
              ),
            },
            sessions: { create: session },
          },
        });
        if (oldToken)
          await tx.session.deleteMany({ where: { sessionToken: oldToken } });
      });
    } else {
      const login = await db.passwordLogin.findUnique({ where: { username } });
      if (!(await verifyPassword(password, login?.passwordHash)) || !login) {
        return invalidCredentials;
      }
      await db.$transaction(async (tx) => {
        await tx.session.create({ data: { ...session, userId: login.userId } });
        if (oldToken)
          await tx.session.deleteMany({ where: { sessionToken: oldToken } });
      });
    }

    (await cookies()).delete(oauthIntentCookie);
    await writeSessionCookie(session);
  } catch (error) {
    if (
      register &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return {
        error: 'That username is unavailable. Choose another username.',
      };
    return unavailable;
  }

  redirect(agreementReviewPath(nextPath));
}
