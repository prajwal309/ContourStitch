'use server';

import { redirect } from 'next/navigation';
import { accountSignInEnabled, currentUser } from './auth';
import { accountFailure, configurationFeedback } from './access-errors';
import { database } from './db';
import { hashPassword, parseUsername, verifyPassword } from './password';
import {
  passwordValidationMessage,
  validPassword,
  validPasswordForVerification,
} from './password-policy';
import { allowPasswordAttempt } from './password-limits';
import { passwordScreeningError } from './password-screening';
import { newRecoveryCode, recoveryCodeHash } from './recovery-code';
import { accountReturnPath } from './return-path';

type RecoveryState = { error?: string; code?: string };

const invalidRecovery = {
  error:
    'Check your username and recovery code. A recovery code can only be used once.',
};
const throttled = {
  error: 'Too many attempts. Wait ten minutes and try again.',
};

export async function issueRecoveryCode(
  expectedUserId: string,
  _: RecoveryState,
  form: FormData,
): Promise<RecoveryState> {
  const password = form.get('password');
  if (!validPasswordForVerification(password))
    return { error: 'Enter your current password.' };
  try {
    const user = await currentUser();
    if (!user || user.id !== expectedUserId)
      return {
        error:
          'Your session expired or changed. Sign in again to manage recovery.',
      };

    const db = database();
    const login = await db.passwordLogin.findUnique({
      where: { userId: user.id },
      select: { username: true, passwordHash: true },
    });
    if (!login)
      return { error: 'This account uses a connected provider for sign-in.' };
    if (!(await allowPasswordAttempt('recovery-code', login.username)))
      return throttled;
    if (!(await verifyPassword(password, login.passwordHash)))
      return { error: 'The current password is incorrect.' };

    const code = newRecoveryCode();
    const updated = await db.passwordLogin.updateMany({
      where: { userId: user.id, passwordHash: login.passwordHash },
      data: { recoveryCodeHash: recoveryCodeHash(code) },
    });
    return updated.count === 1
      ? { code }
      : { error: 'Your password changed. Sign in again to manage recovery.' };
  } catch (error) {
    return accountFailure('issue-recovery-code', error);
  }
}

export async function recoverPassword(
  next: string,
  _: RecoveryState,
  form: FormData,
): Promise<RecoveryState> {
  if (!accountSignInEnabled) return configurationFeedback;
  const username = parseUsername(form.get('username'));
  const codeHash = recoveryCodeHash(form.get('recovery-code'));
  const password = form.get('password');
  if (!username || !codeHash) return invalidRecovery;
  if (!validPassword(password))
    return { error: passwordValidationMessage(password) };
  if (password !== form.get('confirm-password'))
    return { error: 'The passwords do not match.' };

  try {
    if (!(await allowPasswordAttempt('recover', username))) return throttled;
    const db = database();
    const login = await db.passwordLogin.findUnique({
      where: { username, recoveryCodeHash: codeHash },
      select: { userId: true },
    });
    if (!login) return invalidRecovery;
    const screening = await passwordScreeningError(password);
    if (screening) return { error: screening };

    const passwordHash = await hashPassword(password);
    const changed = await db.$transaction(async (tx) => {
      const updated = await tx.passwordLogin.updateMany({
        where: { userId: login.userId, recoveryCodeHash: codeHash },
        data: { passwordHash, recoveryCodeHash: null },
      });
      if (!updated.count) return false;
      await tx.session.deleteMany({ where: { userId: login.userId } });
      return true;
    });
    if (!changed) return invalidRecovery;
  } catch (error) {
    return accountFailure('recover-password', error);
  }

  redirect(
    `/sign-in?notice=PasswordReset&next=${encodeURIComponent(accountReturnPath(next))}`,
  );
}
