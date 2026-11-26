'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/auth/auth';
import { leaveAccount } from '@/lib/auth/actions';
import { database } from '@/lib/auth/db';
import { hasAccountAgreements } from '@/lib/consent/store';
import { prepareProfile } from './profile-data';
import { parseUsername, verifyPassword } from '@/lib/auth/password';
import { allowPasswordAttempt } from '@/lib/auth/password-limits';
import { sessionToken } from '@/lib/auth/sessions';
import { validPasswordForVerification } from '@/lib/auth/password-policy';

async function authorized(expectedUserId: string) {
  const user = await currentUser();
  return user?.id === expectedUserId ? user : null;
}

const sessionError = { ok: false, error: 'session' } as const;
const invalidError = { ok: false, error: 'invalid' } as const;
const unavailableError = { ok: false, error: 'unavailable' } as const;

async function sensitiveChangePasswordError(
  userId: string,
  form: FormData,
  mode: 'delete-account' | 'delete-measurements',
) {
  const login = await database().passwordLogin.findUnique({
    where: { userId },
    select: { username: true, passwordHash: true },
  });
  if (!login) return null;

  const password = form.get('currentPassword');
  if (!validPasswordForVerification(password))
    return 'Enter your current password to confirm this deletion.';
  if (!(await allowPasswordAttempt(mode, login.username)))
    return 'Too many attempts. Wait ten minutes and try again.';
  if (!(await verifyPassword(password, login.passwordHash)))
    return 'The current password is incorrect.';
  return null;
}

export async function createCloudProfile(
  expectedUserId: string,
  input: unknown,
) {
  const user = await authorized(expectedUserId);
  if (!user) return sessionError;
  if (!(await hasAccountAgreements(user.id))) return sessionError;

  const data = prepareProfile(input);
  if (!data) return invalidError;

  const { unit, estimates, corrections, missing, fingerprint } = data;
  const db = database();
  try {
    const profile = await db.$transaction(async (tx) => {
      const [saved] = await tx.measurementProfile.createManyAndReturn({
        data: {
          unit,
          estimates,
          corrections,
          missing,
          fingerprint,
          userId: user.id,
        },
        skipDuplicates: true,
        select: { id: true, version: true, updatedAt: true },
      });
      if (saved) await recordRevision(tx, saved, data);
      return saved;
    });
    if (profile) {
      revalidatePath('/my-measurements');
      return { ok: true, id: profile.id, duplicate: false } as const;
    }

    const existing = await db.measurementProfile.findUnique({
      where: {
        userId_fingerprint: { userId: user.id, fingerprint: data.fingerprint },
      },
      select: { id: true },
    });
    return existing
      ? ({ ok: true, id: existing.id, duplicate: true } as const)
      : unavailableError;
  } catch {
    return unavailableError;
  }
}

export async function updateCloudProfile(
  expectedUserId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const user = await authorized(expectedUserId);
  if (!user) return sessionError;
  if (!(await hasAccountAgreements(user.id))) return sessionError;

  const data = prepareProfile(input);
  if (!data) return invalidError;
  if (!validRevision(id, version)) return invalidError;
  const { unit, estimates, corrections, missing, fingerprint } = data;

  try {
    const saved = await database().$transaction(async (tx) => {
      const updated = await tx.measurementProfile.update({
        where: { id, userId: user.id, version },
        data: {
          unit,
          estimates,
          corrections,
          missing,
          fingerprint,
          version: { increment: 1 },
        },
        select: { id: true, version: true, updatedAt: true },
      });
      await recordRevision(tx, updated, data);
      return updated;
    });

    revalidatePath('/my-measurements');
    revalidatePath(`/my-measurements/${id}`);
    return {
      ok: true,
      version: saved.version,
      updatedAt: saved.updatedAt.toISOString(),
    } as const;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return { ok: false, error: 'duplicate' } as const;
      if (error.code === 'P2025') return { ok: false, error: 'stale' } as const;
    }
    return unavailableError;
  }
}

export async function deleteCloudProfile(
  expectedUserId: string,
  id: string,
  version: number,
) {
  const user = await authorized(expectedUserId);
  if (!user) return sessionError;
  if (!validRevision(id, version)) return invalidError;

  try {
    const result = await database().measurementProfile.deleteMany({
      where: { id, userId: user.id, version },
    });
    if (!result.count) return { ok: false, error: 'stale' } as const;

    revalidatePath('/my-measurements');
    return { ok: true } as const;
  } catch {
    return unavailableError;
  }
}

function validRevision(id: string, version: number) {
  return (
    typeof id === 'string' &&
    /^[a-z0-9]{25}$/.test(id) &&
    Number.isInteger(version) &&
    version > 0 &&
    version < 2_147_483_647
  );
}

async function recordRevision(
  tx: Prisma.TransactionClient,
  profile: { id: string; version: number; updatedAt: Date },
  {
    unit,
    estimates,
    corrections,
    missing,
    observations,
  }: NonNullable<ReturnType<typeof prepareProfile>>,
) {
  const revision = await tx.measurementRevision.create({
    data: {
      profileId: profile.id,
      version: profile.version,
      recordedAt: profile.updatedAt,
      unit,
      estimates,
      corrections,
      missing,
    },
    select: { id: true },
  });
  await tx.measurementObservation.createMany({
    data: observations.map(
      ({ key, valueCm, uncertaintyCm, confidence, method }) => ({
        revisionId: revision.id,
        key,
        valueCm,
        unit,
        uncertaintyCm,
        confidence,
        method,
        recordedAt: profile.updatedAt,
      }),
    ),
  });
}

export async function updateDisplayName(
  expectedUserId: string,
  _: {
    error?: string;
    saved?: boolean;
    savedValues?: {
      name: string;
      firstName: string;
      lastName: string;
      phone: string;
    };
  },
  form: FormData,
): Promise<{
  error?: string;
  saved?: boolean;
  savedValues?: {
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };

  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value.trim() : '';
  };
  const name = field('displayName');
  const firstName = field('firstName');
  const lastName = field('lastName');
  const phone = field('phone');
  if (
    name.length < 2 ||
    name.length > 80 ||
    [name, firstName, lastName, phone].some(
      (value) =>
        value.length > 80 ||
        Array.from(value).some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
    ) ||
    (phone.length > 0 && !/^[+()\d .-]{7,30}$/.test(phone))
  ) {
    return { error: 'Check the profile details and try again.' };
  }

  try {
    await database().user.update({
      where: { id: user.id },
      data: {
        name,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
      },
    });
    revalidatePath('/account');
    revalidatePath('/family-fit/[id]', 'page');
    return { saved: true, savedValues: { name, firstName, lastName, phone } };
  } catch {
    return { error: 'Your display name could not be saved.' };
  }
}

export async function updateProfilePicture(
  expectedUserId: string,
  _: {
    error?: string;
    saved?: boolean;
    savedAt?: string;
    image?: string | null;
  },
  form: FormData,
): Promise<{
  error?: string;
  saved?: boolean;
  savedAt?: string;
  image?: string | null;
}> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };

  const removePicture = form.get('removePicture') === 'on';
  let image: string | null;
  if (removePicture) {
    image = null;
  } else {
    const file = form.get('picture');
    if (!(file instanceof File) || file.size === 0)
      return { error: 'Choose a PNG, JPEG, or WebP image to upload.' };
    if (file.size > 200 * 1024)
      return { error: 'Choose an image smaller than 200 KB.' };

    const bytes = Buffer.from(await file.arrayBuffer());
    const isPng =
      file.type === 'image/png' &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg =
      file.type === 'image/jpeg' &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    const isWebp =
      file.type === 'image/webp' &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!isPng && !isJpeg && !isWebp)
      return { error: 'Use a valid PNG, JPEG, or WebP image.' };

    image = `data:${file.type};base64,${bytes.toString('base64')}`;
  }

  try {
    await database().user.update({
      where: { id: user.id },
      data: { image },
    });
    revalidatePath('/account');
    return { saved: true, savedAt: new Date().toISOString(), image };
  } catch {
    return { error: 'Your profile picture could not be saved.' };
  }
}

export async function updateAccountPreferences(
  expectedUserId: string,
  _: {
    error?: string;
    saved?: boolean;
    savedValues?: {
      measurementUnit: 'cm' | 'in';
      fitPreference: 'slim' | 'regular' | 'relaxed';
    };
  },
  form: FormData,
): Promise<{
  error?: string;
  saved?: boolean;
  savedValues?: {
    measurementUnit: 'cm' | 'in';
    fitPreference: 'slim' | 'regular' | 'relaxed';
  };
}> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };

  const measurementUnit = form.get('measurementUnit');
  const fitPreference = form.get('fitPreference');
  if (
    (measurementUnit !== 'cm' && measurementUnit !== 'in') ||
    (fitPreference !== 'slim' &&
      fitPreference !== 'regular' &&
      fitPreference !== 'relaxed')
  ) {
    return { error: 'Choose a supported unit and fit preference.' };
  }

  try {
    await database().user.update({
      where: { id: user.id },
      data: { measurementUnit, fitPreference },
    });
    revalidatePath('/account');
    return {
      saved: true,
      savedValues: { measurementUnit, fitPreference },
    };
  } catch {
    return { error: 'Your preferences could not be saved.' };
  }
}

export async function updateAccountUsername(
  expectedUserId: string,
  _: { error?: string; saved?: boolean; savedUsername?: string },
  form: FormData,
): Promise<{ error?: string; saved?: boolean; savedUsername?: string }> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };

  const username = parseUsername(form.get('username'));
  const password = form.get('currentPassword');
  if (!username)
    return {
      error: 'Use 3–32 letters, numbers, dots, underscores, or hyphens.',
    };
  if (typeof password !== 'string' || password.length === 0)
    return { error: 'Enter your current password to change your username.' };

  try {
    const db = database();
    const login = await db.passwordLogin.findUnique({
      where: { userId: user.id },
      select: { username: true, passwordHash: true },
    });
    if (!login)
      return { error: 'A username is only available for password sign-in.' };
    if (!(await allowPasswordAttempt('change-username', login.username)))
      return { error: 'Too many attempts. Wait ten minutes and try again.' };
    if (!(await verifyPassword(password, login.passwordHash)))
      return { error: 'The current password is incorrect.' };

    await db.passwordLogin.update({
      where: { userId: user.id },
      data: { username },
    });
    revalidatePath('/account');
    return { saved: true, savedUsername: username };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { error: 'That username is unavailable. Choose another.' };
    }
    return { error: 'Your username could not be updated.' };
  }
}

export async function signOutOtherSessions(
  expectedUserId: string,
  _: { error?: string; message?: string; saved?: boolean },
  form: FormData,
): Promise<{ error?: string; message?: string; saved?: boolean }> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };

  const password = form.get('currentPassword');
  if (typeof password !== 'string' || password.length === 0)
    return { error: 'Enter your current password to manage sessions.' };

  try {
    const db = database();
    const login = await db.passwordLogin.findUnique({
      where: { userId: user.id },
      select: { username: true, passwordHash: true },
    });
    if (!login)
      return {
        error:
          'Session management requires password sign-in for reauthentication.',
      };
    if (!(await allowPasswordAttempt('session-management', login.username)))
      return { error: 'Too many attempts. Wait ten minutes and try again.' };
    if (!(await verifyPassword(password, login.passwordHash)))
      return { error: 'The current password is incorrect.' };

    const token = await sessionToken();
    if (!token)
      return {
        error: 'Your active session could not be verified. Sign in again.',
      };
    const result = await db.session.deleteMany({
      where: {
        userId: user.id,
        expires: { gt: new Date() },
        sessionToken: { not: token },
      },
    });
    revalidatePath('/account');
    return {
      saved: true,
      message: result.count
        ? `${result.count} other session${result.count === 1 ? '' : 's'} signed out.`
        : 'There were no other active sessions.',
    };
  } catch {
    return { error: 'Other sessions could not be signed out.' };
  }
}

export async function deleteAccount(
  expectedUserId: string,
  _: { error?: string },
  form: FormData,
): Promise<{ error?: string }> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };
  if (form.get('confirmation') !== 'DELETE')
    return { error: 'Type DELETE to confirm.' };

  try {
    const passwordError = await sensitiveChangePasswordError(
      user.id,
      form,
      'delete-account',
    );
    if (passwordError) return { error: passwordError };
    await database().$transaction(
      async (tx) => {
        const groups = await tx.familyGroup.findMany({
          where: { organizerId: user.id },
          select: {
            id: true,
            members: {
              where: { userId: { not: user.id } },
              orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
              take: 1,
              select: { userId: true },
            },
          },
        });
        for (const group of groups) {
          const successor = group.members[0];
          if (!successor) continue;
          await tx.familyGroup.update({
            where: { id: group.id },
            data: { organizerId: successor.userId },
          });
          await tx.familyInvitation.updateMany({
            where: { groupId: group.id, redeemedAt: null, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await tx.user.delete({ where: { id: user.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { error: 'Your account could not be deleted. Please try again.' };
  }
  await leaveAccount();
  return {};
}

export async function deleteAccountMeasurements(
  expectedUserId: string,
  _: { error?: string; saved?: boolean },
  form: FormData,
): Promise<{ error?: string; saved?: boolean }> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };
  if (form.get('confirmation') !== 'DELETE')
    return { error: 'Type DELETE to confirm.' };

  try {
    const passwordError = await sensitiveChangePasswordError(
      user.id,
      form,
      'delete-measurements',
    );
    if (passwordError) return { error: passwordError };
    const db = database();
    await db.$transaction(
      [
        db.outfitSelection.deleteMany({ where: { userId: user.id } }),
        db.measurementProfile.deleteMany({ where: { userId: user.id } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidatePath('/my-measurements');
    revalidatePath('/my-measurements/[id]', 'page');
    revalidatePath('/family-fit/[id]', 'page');
    return { saved: true };
  } catch {
    return {
      error: 'Your measurements could not be deleted. Please try again.',
    };
  }
}
