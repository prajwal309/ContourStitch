'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useSession } from '@/components/SessionProvider';
import { createCloudProfile } from '@/lib/accounts/actions';
import { loadProfile, type LocalProfile } from '@/lib/storage/profile';

export function CloudProfileSources({ userId }: { userId: string }) {
  const { report, unit } = useSession();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{
    id: string;
    duplicate: boolean;
  } | null>(null);
  const [expired, setExpired] = useState(false);

  function save(source: 'current' | 'device') {
    setMessage('');
    setResult(null);
    setExpired(false);

    let profile: LocalProfile | null;
    try {
      profile =
        source === 'device'
          ? loadProfile()
          : report && { version: 1, report, unit };
    } catch {
      setMessage('Browser storage is unavailable.');
      return;
    }
    if (!profile?.report.estimates.length) {
      setMessage(
        source === 'device'
          ? 'There are no saved measurements on this device.'
          : 'Enter or estimate measurements first.',
      );
      return;
    }

    startTransition(async () => {
      try {
        const response = await createCloudProfile(userId, profile);
        if (response.ok) {
          setResult({ id: response.id, duplicate: response.duplicate });
        } else if (response.error === 'session') {
          setExpired(true);
          setMessage('Your session expired or changed.');
        } else {
          setMessage(
            'These measurements could not be saved. Review them or try again.',
          );
        }
      } catch {
        setMessage('Unable to connect. Please try again.');
      }
    });
  }

  return (
    <section className="account-section" aria-labelledby="save-profile">
      <h2 id="save-profile">Save a profile</h2>
      <p className="muted">
        Choose which measurements to add to your account. Import keeps the saved
        copy on this device.
      </p>
      <div className="account-actions">
        {!!report?.estimates.length && (
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => save('current')}
          >
            Save current measurements
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={() => save('device')}
        >
          Import from this device
        </button>
      </div>
      <div role="status" className="status-message">
        {pending ? 'Saving measurements…' : message}
        {expired && (
          <>
            {' '}
            <Link className="inline-link" href="/sign-in">
              Sign in again
            </Link>
          </>
        )}
        {result && (
          <>
            {result.duplicate
              ? 'These measurements are already saved.'
              : 'Measurements saved to your account.'}{' '}
            <Link
              className="inline-link"
              href={`/my-measurements/${result.id}`}
              prefetch={false}
            >
              View profile
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
