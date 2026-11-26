'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  checkedRegistrationVersions,
  matchesVersions,
  validRegistrationVersions,
} from '@/lib/consent/agreements';
import { registrationEvents } from '@/lib/consent/store';
import { accountSignInEnabled, currentUser } from './auth';
import { database } from './db';
import { oauthIntentCookie } from './oauth-intent';
import { hashPassword, parseUsername, verifyPassword } from './password';
import {
  passwordValidationMessage,
  validPassword,
  validPasswordForVerification,
} from './password-policy';
import { passwordScreeningError } from './password-screening';
import { accountFailure, configurationFeedback } from './access-errors';
import { allowPasswordAttempt } from './password-limits';
import { agreementReviewPath } from './return-path';
import { newSession, sessionToken, writeSessionCookie } from './sessions';

export type PasswordFeedback = { error?: string; saved?: boolean };

const invalidCredentials = {
  error: 'Check your username and password and try again.',
};
const throttled = {
  error: 'Too many attempts. Wait ten minutes and try again.',
};

export async function submitPassword(
  mode: 'register' | 'sign-in',
  nextPath: string,
  _previous: PasswordFeedback,
  form: FormData,
): Promise<PasswordFeedback> {
  if (!accountSignInEnabled) return configurationFeedback;
  if (mode !== 'register' && mode !== 'sign-in') return configurationFeedback;

  const username = parseUsername(form.get('username'));
  const password = form.get('password');
  const register = mode === 'register';
  if (!username)
    return register
      ? {
          error:
            'Enter a username using 3 to 32 letters, numbers, dots, underscores, or hyphens.',
        }
      : invalidCredentials;
  if (typeof password !== 'string')
    return register
      ? { error: passwordValidationMessage(password) }
      : invalidCredentials;
  if (register && !validPassword(password))
    return { error: passwordValidationMessage(password) };
  if (!register && !validPasswordForVerification(password))
    return invalidCredentials;
  if (register && form.get('confirm-password') !== password) {
    return { error: 'The passwords do not match.' };
  }

  const versions = checkedRegistrationVersions(form);
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
      const screening = await passwordScreeningError(password);
      if (screening) return { error: screening };
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
      const login = await db.passwordLogin.findUnique({
        where: { username },
        select: { userId: true, passwordHash: true },
      });
      if (!(await verifyPassword(password, login?.passwordHash)) || !login)
        return invalidCredentials;

      const signedIn = await db.$transaction(async (tx) => {
        // Serialize session creation with recovery. An old password cannot establish a new session after reset.
        const [current] = await tx.$queryRaw<{ userId: string }[]>`
          SELECT "userId" FROM "PasswordLogin"
          WHERE "userId" = ${login.userId} AND "passwordHash" = ${login.passwordHash}
          FOR UPDATE
        `;
        if (!current) return false;
        await tx.session.create({ data: { ...session, userId: login.userId } });
        if (oldToken)
          await tx.session.deleteMany({ where: { sessionToken: oldToken } });
        return true;
      });
      if (!signedIn) return invalidCredentials;
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
    return accountFailure(
      mode === 'register' ? 'register-password' : 'sign-in-password',
      error,
    );
  }

  redirect(agreementReviewPath(nextPath));
}

export async function changePassword(
  expectedUserId: string,
  _: PasswordFeedback,
  form: FormData,
): Promise<PasswordFeedback> {
  const currentPassword = form.get('currentPassword');
  const password = form.get('newPassword');
  if (!validPasswordForVerification(currentPassword))
    return { error: 'Enter your current password.' };
  if (!validPassword(password))
    return { error: passwordValidationMessage(password) };
  if (password !== form.get('confirmPassword'))
    return { error: 'The new passwords do not match.' };

  try {
    const user = await currentUser();
    if (!user || user.id !== expectedUserId)
      return { error: 'Your session changed. Sign in again to continue.' };

    const db = database();
    const login = await db.passwordLogin.findUnique({
      where: { userId: user.id },
      select: { username: true, passwordHash: true },
    });
    if (!login) return { error: 'A password is not set up for this account.' };
    if (!(await allowPasswordAttempt('change-password', login.username)))
      return throttled;
    if (!(await verifyPassword(currentPassword, login.passwordHash)))
      return { error: 'The current password is incorrect.' };
    const screening = await passwordScreeningError(password);
    if (screening) return { error: screening };

    const passwordHash = await hashPassword(password);
    const token = await sessionToken();
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.passwordLogin.updateMany({
        where: { userId: user.id, passwordHash: login.passwordHash },
        data: { passwordHash, recoveryCodeHash: null },
      });
      if (!result.count) return false;
      await tx.session.deleteMany({
        where: {
          userId: user.id,
          ...(token ? { sessionToken: { not: token } } : {}),
        },
      });
      return true;
    });
    if (!updated)
      return { error: 'Your password changed in another session. Try again.' };
    revalidatePath('/account');
    return { saved: true };
  } catch (error) {
    return accountFailure('change-password', error);
  }
}
