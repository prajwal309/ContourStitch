'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/auth/auth';
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

  const profiles = database().measurementProfile;
  try {
    const [profile] = await profiles.createManyAndReturn({
      data: { ...data, userId: user.id },
      skipDuplicates: true,
      select: { id: true },
    });
    if (profile) {
      revalidatePath('/my-measurements');
      return { ok: true, id: profile.id, duplicate: false } as const;
    }

    const existing = await profiles.findUnique({
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

  try {
    const saved = await database().measurementProfile.update({
      where: { id, userId: user.id, version },
      data: { ...data, version: { increment: 1 } },
      select: { version: true, updatedAt: true },
    });

    revalidatePath('/my-measurements');
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
