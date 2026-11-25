import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/auth';
import { accountReturnPath, signInFor } from '@/lib/auth/return-path';
import { accountAgreements, missingAgreements } from '@/lib/consent/agreements';
import { readConsent } from '@/lib/consent/store';
import { AccountAgreementForm } from '@/components/consent/AccountAgreementForm';

export const metadata = { title: 'Review your agreements | ContourStitch' };
export const dynamic = 'force-dynamic';

export default async function AgreementReview({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const path = accountReturnPath((await searchParams).next);
  const user = await currentUser();
  if (!user) redirect(signInFor(path));
  const required = missingAgreements(
    await readConsent(user.id),
    accountAgreements,
  );
  if (!required.length) redirect(path);

  return (
    <main id="main" className="flow">
      <section className="flow-card">
        <h1>Review your agreements</h1>
        <p>Your body. Your data. Your choice.</p>
        <p>
          Review the current documents before continuing to your account
          features.
        </p>
        <AccountAgreementForm
          key={user.id}
          userId={user.id}
          next={path}
          required={required}
        />
        <Link href="/account#privacy-consent" className="text-button">
          Open Privacy &amp; Consent settings
        </Link>
      </section>
    </main>
  );
}
