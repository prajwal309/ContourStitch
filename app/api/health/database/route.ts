import { currentUser } from '@/lib/auth/auth';
import { database } from '@/lib/auth/db';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    if (!(await currentUser()))
      return Response.json(
        { status: 'unauthorized' },
        { status: 401, headers: noStore },
      );

    const [schema] = await database().$queryRaw<{ ready: boolean }[]>`
      SELECT COUNT(*) = 12 AS ready
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (
          'User',
          'Account',
          'Session',
          'MeasurementProfile',
          'MeasurementRevision',
          'MeasurementObservation',
          'FamilyGroup',
          'FamilyMembership',
          'FamilyInvitation',
          'FamilyProfileShare',
          'OutfitSelection',
          '_prisma_migrations'
        )
    `;
    if (!schema?.ready)
      return Response.json(
        { status: 'unavailable' },
        { status: 503, headers: noStore },
      );
    return Response.json({ status: 'ok' }, { headers: noStore });
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: noStore },
    );
  }
}
