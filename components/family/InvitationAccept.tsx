'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signInFor } from '@/lib/auth/return-path';
import { joinGroup } from '@/lib/family/actions';

const storageKey = 'contourstitch.family-invitation';
function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
const initial = () => '';
const valid = (value: string) => /^[a-f0-9]{64}$/.test(value);
function token() {
  const hash = window.location.hash.slice(1);
  if (hash) return valid(hash) ? hash : '';
  try {
    const saved = window.sessionStorage.getItem(storageKey) ?? '';
    return valid(saved) ? saved : '';
  } catch {
    return '';
  }
}

export function InvitationAccept({ userId }: { userId: string | null }) {
  const code = useSyncExternalStore(subscribe, token, initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  function rememberInvitation() {
    try {
      window.sessionStorage.setItem(storageKey, code);
    } catch {
      // The original invitation can be reopened after sign-in.
    }
  }

  function accept() {
    if (!userId || !code) return;
    setError('');
    start(async () => {
      try {
        const result = await joinGroup(userId, code);
        if (result.groupId) {
          try {
            window.sessionStorage.removeItem(storageKey);
          } catch {
            /* Optional storage. */
          }
          router.replace(`/family-fit/${result.groupId}`);
        } else
          setError(result.error ?? 'This invitation could not be accepted.');
      } catch {
        setError('This invitation could not be accepted.');
      }
    });
  }

  if (!code)
    return (
      <p>Open the invitation link sent by your organizer in this browser.</p>
    );

  return (
    <>
      <p>
        Join the group to choose an outfit from its shared collection. Your fit
        profile and body measurements stay private.
      </p>
      {userId ? (
        <button
          type="button"
          className="button"
          onClick={accept}
          disabled={pending}
        >
          {pending ? 'Joining…' : 'Accept invitation'}
        </button>
      ) : (
        <>
          <Link
            className="button"
            href={signInFor('/family-fit/invite')}
            onClick={rememberInvitation}
          >
            Sign in to accept
          </Link>
          <p className="muted">
            Keep the original link handy so you can reopen it after signing in.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
