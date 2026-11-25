import { GuidedMeasurement } from '@/components/measurement/GuidedMeasurement';
import { measurementAccess } from '@/lib/consent/access';

export const dynamic = 'force-dynamic';

export default async function Measure() {
  const access = await measurementAccess('/measure');
  return <GuidedMeasurement key={access.userId ?? 'guest'} access={access} />;
}
