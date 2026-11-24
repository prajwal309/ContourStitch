import type { Metadata } from 'next';
import ExperimentalRotation from '@/components/scanner/ExperimentalRotation';

export const metadata: Metadata = {
  title: 'Experimental measurement engines | ContourStitch',
  robots: { index: false, follow: false },
};

export default function ExperimentalPage() {
  return <ExperimentalRotation />;
}
