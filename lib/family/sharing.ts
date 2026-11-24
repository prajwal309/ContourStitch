'use server';

import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';

type Result = { error?: string; message?: string };

export async function updateFamilyShare(
  groupId: string,
  expectedMemberId: string,
  organizerId: string,
  _: Result,
  form: FormData,
): Promise<Result> {
  const user = await currentUser();
  if (!user || user.id !== expectedMemberId)
    return { error: 'Your session changed. Sign in again to continue.' };

  const key = { groupId, memberId: user.id };
  if (form.get('operation') === 'revoke') {
    try {
      await database().familyProfileShare.deleteMany({ where: key });
      revalidatePath(`/family-fit/${groupId}`);
      return { message: 'Measurement access revoked.' };
    } catch {
      return { error: 'Access could not be revoked. Please try again.' };
    }
  }

  const revisionId = form.get('revision');
  if (
    form.get('operation') !== 'share' ||
    typeof revisionId !== 'string' ||
    !/^[a-z0-9]{25}$/.test(revisionId)
  )
    return { error: 'Choose one of your saved measurement sets.' };

  try {
    const saved = await database().$transaction(async (tx) => {
      const membership = await tx.familyMembership.findUnique({
        where: { groupId_userId: { groupId, userId: user.id } },
        select: { group: { select: { organizerId: true } } },
      });
      if (
        !membership ||
        organizerId === user.id ||
        membership.group.organizerId !== organizerId
      )
        return false;

      const revision = await tx.measurementRevision.findUnique({
        where: { id: revisionId, profile: { userId: user.id } },
        select: { id: true },
      });
      if (!revision) return false;

      await tx.familyProfileShare.upsert({
        where: { groupId_memberId: key },
        create: { ...key, organizerId, revisionId },
        update: { organizerId, revisionId },
      });
      return true;
    });
    if (!saved)
      return {
        error:
          'Your profile or group organizer changed. Refresh and try again.',
      };
    revalidatePath(`/family-fit/${groupId}`);
    return { message: 'Measurements shared with the organizer.' };
  } catch {
    return { error: 'Measurements could not be shared. Please try again.' };
  }
}
