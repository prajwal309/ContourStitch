import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to download your personal information.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const data = await database().user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerified: true,
      image: true,
      phone: true,
      measurementUnit: true,
      fitPreference: true,
      createdAt: true,
      accounts: { select: { provider: true, type: true } },
      passwordLogin: { select: { username: true } },
      consentEvents: {
        orderBy: { recordedAt: 'asc' },
        select: {
          type: true,
          status: true,
          agreementVersion: true,
          recordedAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
      },
      profiles: {
        orderBy: { updatedAt: 'desc' },
        include: {
          revisions: {
            orderBy: { version: 'asc' },
            include: { measurements: true },
          },
        },
      },
      familyMemberships: {
        include: {
          group: {
            select: { name: true, occasion: true, createdAt: true },
          },
        },
      },
      organizedGroups: {
        select: { name: true, occasion: true, createdAt: true },
      },
    },
  });

  if (!data) {
    return Response.json(
      { error: 'Your account information could not be found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(data, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition':
        'attachment; filename="contourstitch-personal-information.json"',
    },
  });
}
