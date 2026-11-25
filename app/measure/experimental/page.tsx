import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ExperimentalRotation from '@/components/scanner/ExperimentalRotation';

import { measurementAccess } from '@/lib/consent/access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Experimental measurement engines | ContourStitch',
  robots: { index: false, follow: false },
};

export default async function ExperimentalPage() {
  if (process.env.NODE_ENV === 'production') redirect('/measure');
  const access = await measurementAccess('/measure/experimental');
  return (
    <ExperimentalRotation key={access.userId ?? 'guest'} access={access} />
  );
}
