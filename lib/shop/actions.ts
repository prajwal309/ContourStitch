'use server';

import { revalidatePath } from 'next/cache';
import { restoreProfile } from '@/lib/accounts/profile-data';
import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';
import { getProduct } from './catalog';
import { preferences, readExtraMeasurements } from './fit';

type Feedback = { error?: string; saved?: boolean };

export async function saveOutfit(
  userId: string,
  productKey: string,
  groupId: string | null,
  _: Feedback,
  form: FormData,
): Promise<Feedback> {
  if ((await currentUser())?.id !== userId)
    return {
      error: 'Your session changed. Sign in again to save your outfit.',
    };

  const product = getProduct(productKey);
  const variantKey = form.get('variant');
  const preference = form.get('preference');
  const profileChoice = form.get('revision');

  if (
    !product ||
    typeof variantKey !== 'string' ||
    !product.variants.some(({ key }) => key === variantKey) ||
    typeof preference !== 'string' ||
    !preferences.some((value) => value === preference) ||
    typeof profileChoice !== 'string'
  ) {
    return { error: 'Choose a valid color, fit profile and fit preference.' };
  }

  try {
    const saved = await database().$transaction(
      async (tx): Promise<Feedback> => {
        if (groupId) {
          const membership = await tx.familyMembership.findUnique({
            where: {
              groupId_userId: { groupId, userId },
              group: { collectionKey: product.collectionKey },
            },
            select: { userId: true },
          });
          if (!membership)
            return { error: 'This outfit is unavailable for your group.' };
        }

        const revision = profileChoice
          ? await tx.measurementRevision.findUnique({
              where: { id: profileChoice, profile: { userId } },
              select: {
                id: true,
                unit: true,
                estimates: true,
                corrections: true,
                missing: true,
              },
            })
          : null;
        if (profileChoice && !revision)
          return {
            error: 'This fit profile is unavailable. Reload to choose another.',
          };

        const profile = revision ? restoreProfile(revision) : null;
        if (revision && !profile)
          return { error: 'This fit profile could not be loaded.' };
        const extra = readExtraMeasurements(
          product,
          profile?.report.estimates.map(({ key }) => key) ?? [],
          form,
        );
        if (!extra)
          return {
            error:
              'Enter missing measurements in centimetres, from more than 0 to 300.',
          };

        const scopeKey = groupId
          ? `group:${groupId}`
          : `personal:${product.key}`;
        const outfit = {
          productKey: product.key,
          variantKey,
          fitRevisionId: revision?.id ?? null,
          preference,
          extraCm: extra.values,
          fitComplete: extra.complete,
          usesProfile: extra.usesProfile,
        };
        await tx.outfitSelection.upsert({
          where: { userId_scopeKey: { userId, scopeKey } },
          update: outfit,
          create: { ...outfit, userId, scopeKey, groupId },
        });
        return { saved: true };
      },
    );

    if (saved.saved) {
      revalidatePath('/account');
      if (groupId) revalidatePath(`/family-fit/${groupId}`);
    }
    return saved;
  } catch {
    return { error: 'Your outfit could not be saved. Please try again.' };
  }
}

export async function removeOutfit(
  userId: string,
  selectionId: string,
): Promise<Feedback> {
  if ((await currentUser())?.id !== userId)
    return { error: 'Your session changed. Sign in again to continue.' };
  try {
    await database().outfitSelection.deleteMany({
      where: { id: selectionId, userId },
    });
    revalidatePath('/account');
    revalidatePath('/family-fit/[id]', 'page');
    revalidatePath('/shop/[slug]', 'page');
    return { saved: true };
  } catch {
    return { error: 'Your outfit could not be removed. Please try again.' };
  }
}
