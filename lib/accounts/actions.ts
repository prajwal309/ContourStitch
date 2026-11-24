'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/auth/auth';
import { leaveAccount } from '@/lib/auth/actions';
import { database } from '@/lib/auth/db';
import { prepareProfile } from './profile-data';

async function authorized(expectedUserId: string) {
  const user = await currentUser();
  return user?.id === expectedUserId ? user : null;
}

const sessionError = { ok: false, error: 'session' } as const;
const invalidError = { ok: false, error: 'invalid' } as const;
const unavailableError = { ok: false, error: 'unavailable' } as const;

export async function createCloudProfile(
  expectedUserId: string,
  input: unknown,
) {
  const user = await authorized(expectedUserId);
  if (!user) return sessionError;

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
  _: { error?: string; saved?: boolean },
  form: FormData,
): Promise<{ error?: string; saved?: boolean }> {
  const user = await authorized(expectedUserId);
  if (!user)
    return { error: 'Your session changed. Sign in again to continue.' };

  const value = form.get('displayName');
  const name = typeof value === 'string' ? value.trim() : '';
  if (
    name.length < 2 ||
    name.length > 80 ||
    Array.from(name).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    return { error: 'Enter a display name of 2 to 80 characters.' };
  }

  try {
    await database().user.update({ where: { id: user.id }, data: { name } });
    revalidatePath('/account');
    revalidatePath('/family-fit/[id]', 'page');
    return { saved: true };
  } catch {
    return { error: 'Your display name could not be saved.' };
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
