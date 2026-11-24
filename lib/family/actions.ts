'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { getCollection } from '@/lib/shop/catalog';

type Response = { error?: string; code?: string; groupId?: string };
const unavailable = 'That change couldn’t be saved. Please try again.';
const expiredSession = 'Your session changed. Sign in again to continue.';
const inviteDuration = 7 * 24 * 60 * 60 * 1000;
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export async function createGroup(
  userId: string,
  _: Response,
  form: FormData,
): Promise<Response> {
  if ((await currentUser())?.id !== userId) return { error: expiredSession };
  const name = form.get('name');
  const occasion = form.get('occasion');
  const collection = form.get('collection');
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 80 ||
    (occasion !== null &&
      (typeof occasion !== 'string' || occasion.trim().length > 120)) ||
    typeof collection !== 'string' ||
    !getCollection(collection)
  ) {
    return {
      error:
        'Enter a group name of 2 to 80 characters and an optional occasion of up to 120 characters.',
    };
  }

  let id: string;
  try {
    const group = await database().familyGroup.create({
      data: {
        name: name.trim(),
        occasion: typeof occasion === 'string' ? occasion.trim() || null : null,
        collectionKey: collection,
        organizerId: userId,
        members: { create: { userId } },
      },
      select: { id: true },
    });
    id = group.id;
  } catch {
    return { error: unavailable };
  }
  revalidatePath('/family-fit');
  redirect(`/family-fit/${id}`);
}

export async function createInvitation(
  userId: string,
  groupId: string,
): Promise<Response> {
  if ((await currentUser())?.id !== userId) return { error: expiredSession };
  const code = randomBytes(32).toString('hex');
  try {
    const group = await database().familyGroup.findUnique({
      where: { id: groupId, organizerId: userId },
      select: { id: true },
    });
    if (!group) return { error: 'Only the organizer can invite members.' };
    await database().familyInvitation.create({
      data: {
        groupId,
        tokenHash: hash(code),
        expiresAt: new Date(Date.now() + inviteDuration),
      },
    });
    revalidatePath(`/family-fit/${groupId}`);
    return { code };
  } catch {
    return { error: unavailable };
  }
}

export async function revokeInvitation(
  userId: string,
  groupId: string,
  invitationId: string,
): Promise<Response> {
  if ((await currentUser())?.id !== userId) return { error: expiredSession };
  try {
    await database().familyInvitation.updateMany({
      where: {
        id: invitationId,
        groupId,
        revokedAt: null,
        redeemedAt: null,
        group: { organizerId: userId },
      },
      data: { revokedAt: new Date() },
    });
    revalidatePath(`/family-fit/${groupId}`);
    return {};
  } catch {
    return { error: unavailable };
  }
}

export async function joinGroup(
  userId: string,
  code: unknown,
): Promise<Response> {
  if ((await currentUser())?.id !== userId) return { error: expiredSession };
  const invalid = {
    error:
      'This invitation is invalid, expired, revoked, or already used. Ask the organizer for a new link.',
  };
  if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) return invalid;

  try {
    const joined = await database().$transaction(async (tx) => {
      const invite = await tx.familyInvitation.findUnique({
        where: { tokenHash: hash(code) },
        select: {
          id: true,
          groupId: true,
          expiresAt: true,
          revokedAt: true,
          redeemedById: true,
        },
      });
      if (!invite) return null;
      const memberKey = { groupId: invite.groupId, userId };
      const member = await tx.familyMembership.findUnique({
        where: { groupId_userId: memberKey },
        select: { userId: true },
      });
      if (invite.redeemedById === userId && member) return invite.groupId;

      const now = new Date();
      if (invite.revokedAt || invite.expiresAt <= now) return null;
      if (member && !invite.redeemedById) return invite.groupId;

      const claimed = await tx.familyInvitation.updateMany({
        where: {
          id: invite.id,
          expiresAt: { gt: now },
          redeemedAt: null,
          revokedAt: null,
        },
        data: { redeemedAt: now, redeemedById: userId },
      });
      if (!claimed.count) return null;

      await tx.familyMembership.upsert({
        where: { groupId_userId: memberKey },
        create: memberKey,
        update: {},
      });
      return invite.groupId;
    });
    if (!joined) return invalid;
    revalidatePath('/family-fit');
    revalidatePath(`/family-fit/${joined}`);
    return { groupId: joined };
  } catch {
    return { error: unavailable };
  }
}
