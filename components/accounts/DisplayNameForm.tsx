'use client';

import { useActionState, useState } from 'react';
import { updateDisplayName } from '@/lib/accounts/actions';

export function DisplayNameForm({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [state, submit, pending] = useActionState(
    updateDisplayName.bind(null, userId),
    {},
  );
  return (
    <form action={submit} className="studio-form">
      <fieldset disabled={pending}>
        <legend>Profile settings</legend>
        <label>
          Display name
          <input
            name="displayName"
            type="text"
            value={name}
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="muted">
          Group organizers can see this name beside your outfit.
        </p>
        <button type="submit" className="secondary-button">
          {pending ? 'Saving…' : 'Save display name'}
        </button>
      </fieldset>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="status-message">
          Display name saved.
        </p>
      )}
    </form>
  );
}
