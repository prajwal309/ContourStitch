import { notFound } from 'next/navigation';
import ExperimentalRotation from '@/components/scanner/ExperimentalRotation';

export default function ExperimentalPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ExperimentalRotation />;
}
