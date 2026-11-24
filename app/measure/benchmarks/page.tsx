import type { Metadata } from 'next';
import Link from 'next/link';
import { BenchmarkDashboard } from '@/components/reconstruction/BenchmarkDashboard';

export const metadata: Metadata = {
  title: 'Research benchmarks | ContourStitch',
  robots: { index: false, follow: false },
};

export default function BenchmarksPage() {
  return (
    <main id="main" className="flow">
      <section className="flow-card benchmark-card">
        <p className="eyebrow">RESEARCH TOOL</p>
        <h1>Algorithm comparison</h1>
        <p>
          Import de-identified tape references and engine outputs to summarize
          observed performance. Do not include names, photographs, video, or
          other identifying information.
        </p>
        <BenchmarkDashboard />
        <Link className="text-button" href="/measure/experimental">
          Return to engine comparison
        </Link>
      </section>
    </main>
  );
}
