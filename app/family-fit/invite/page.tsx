import Link from 'next/link';
import { currentUser } from '@/lib/auth/auth';
import { InvitationAccept } from '@/components/family/InvitationAccept';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Group invitation | ContourStitch',
  robots: { index: false, follow: false },
};

export default async function Invite() {
  const user = await currentUser();
  return (
    <main id="main" className="flow">
      <section className="flow-card">
        <p className="eyebrow">Family Fit Studio</p>
        <h1>Group invitation</h1>
        <InvitationAccept userId={user?.id ?? null} />
        <Link href="/family-fit" className="text-button">
          Back to Family Fit Studio
        </Link>
      </section>
    </main>
  );
}
