'use client';

import { useActionState } from 'react';
import { deleteAccount } from '@/lib/accounts/actions';

export function DeleteAccountForm({ userId }: { userId: string }) {
  const [state, submit, pending] = useActionState(
    deleteAccount.bind(null, userId),
    {},
  );

  return (
    <details className="studio-section delete-confirm">
      <summary>Delete my account</summary>
      <p>
        This permanently deletes your account, saved fit profiles, and their
        history. Family groups with other members pass to the earliest member
        still in the group. Empty groups are deleted.
      </p>
      <p>
        Measurements saved on this device can be deleted from the results page.
      </p>
      <form className="studio-form" action={submit}>
        <label>
          Type DELETE to confirm
          <input name="confirmation" required autoComplete="off" />
        </label>
        <button type="submit" className="secondary-button" disabled={pending}>
          {pending ? 'Deleting account…' : 'Permanently delete account'}
        </button>
        {state.error && (
          <p role="alert" className="error">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
