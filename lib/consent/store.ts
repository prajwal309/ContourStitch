import 'server-only';

import type { Prisma } from '@prisma/client';
import { database } from '@/lib/auth/db';
import {
  agreements,
  accountAgreements,
  activeAgreementTypes,
  currentAcceptance,
  missingAgreements,
  type Agreement,
  type ConsentEvent,
  type ConsentState,
} from './agreements';

export async function readConsent(
  userId: string,
  db: Prisma.TransactionClient = database(),
) {
  const events = await db.consentEvent.findMany({
    where: { userId },
    orderBy: { id: 'desc' },
    distinct: ['type'],
    select: {
      type: true,
      status: true,
      agreementVersion: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });
  const state: ConsentState = {};
  for (const event of events) state[event.type] = event;
  return state;
}

export async function hasAccountAgreements(userId: string) {
  return (
    missingAgreements(await readConsent(userId), accountAgreements).length === 0
  );
}

function acceptance(type: Agreement, acceptedAt: Date) {
  return {
    type,
    status: 'ACCEPTED' as const,
    agreementVersion: agreements[type].version,
    acceptedAt,
    revokedAt: null,
  };
}

export function registrationEvents(improvement: boolean) {
  const now = new Date();
  return [
    ...accountAgreements.map((type) => acceptance(type, now)),
    improvement
      ? acceptance('IMPROVEMENT', now)
      : {
          type: 'IMPROVEMENT' as const,
          status: 'DECLINED' as const,
          agreementVersion: agreements.IMPROVEMENT.version,
        },
  ];
}

export function changeConsent(
  userId: string,
  change: (state: ConsentState) => ConsentEvent[],
) {
  return database().$transaction(async (tx) => {
    // Serialize changes for this user so simultaneous submissions cannot append conflicting decisions.
    const [owner] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (!owner) return false;
    const state = await readConsent(userId, tx);
    const events = change(state).map((event) => ({ ...event, userId }));
    if (events.length) await tx.consentEvent.createMany({ data: events });
    return true;
  });
}

export function acceptMissing(
  state: ConsentState,
  required: readonly Agreement[],
) {
  const now = new Date();
  return missingAgreements(state, required).map((type) =>
    acceptance(type, now),
  );
}

export function withdraw(
  state: ConsentState,
  type: 'BODY_MEASUREMENT' | 'IMPROVEMENT',
) {
  const event = state[type];
  if (event?.status !== 'ACCEPTED' || !event.acceptedAt) return [];
  return [{ ...event, status: 'REVOKED' as const, revokedAt: new Date() }];
}

export function reviewableAgreements(state: ConsentState) {
  return activeAgreementTypes.map((type) => ({
    type,
    event: state[type],
    active: currentAcceptance(state, type),
  }));
}

export async function readAcceptedVersions(userId: string) {
  return database().$queryRaw<
    { type: Agreement; agreementVersion: string; acceptedAt: Date }[]
  >`
    SELECT DISTINCT ON ("type", "agreementVersion") "type", "agreementVersion", "acceptedAt"
    FROM "ConsentEvent"
    WHERE "userId" = ${userId} AND "status" = 'ACCEPTED'
    ORDER BY "type", "agreementVersion", "id" DESC
  `;
}
