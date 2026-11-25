import type { Metadata } from 'next';
import ExperimentalRotation from '@/components/scanner/ExperimentalRotation';

import { measurementAccess } from '@/lib/consent/access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Experimental measurement engines | ContourStitch',
  robots: { index: false, follow: false },
};

export default async function ExperimentalPage() {
  const access = await measurementAccess('/measure/experimental');
  return (
    <ExperimentalRotation key={access.userId ?? 'guest'} access={access} />
  );
}
