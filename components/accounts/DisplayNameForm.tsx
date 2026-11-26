'use client';

import { useActionState, useState } from 'react';
import { updateDisplayName } from '@/lib/accounts/actions';

export function DisplayNameForm({
  userId,
  initialName,
  initialFirstName,
  initialLastName,
  initialPhone,
}: {
  userId: string;
  initialName: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
}) {
  const [name, setName] = useState(initialName);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const initialValues = {
    name: initialName,
    firstName: initialFirstName,
    lastName: initialLastName,
    phone: initialPhone,
  };
  const [state, submit, pending] = useActionState(
    updateDisplayName.bind(null, userId),
    { savedValues: initialValues },
  );
  const savedValues = state.savedValues ?? initialValues;
  const dirty =
    name !== savedValues.name ||
    firstName !== savedValues.firstName ||
    lastName !== savedValues.lastName ||
    phone !== savedValues.phone;

  return (
    <form action={submit} className="studio-form account-profile-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">Personal profile</legend>
        <div className="account-form-grid">
          <label>
            First name <span className="muted">(private)</span>
            <input
              name="firstName"
              type="text"
              value={firstName}
              autoComplete="given-name"
              maxLength={80}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>
          <label>
            Last name <span className="muted">(private)</span>
            <input
              name="lastName"
              type="text"
              value={lastName}
              autoComplete="family-name"
              maxLength={80}
              onChange={(event) => setLastName(event.target.value)}
            />
          </label>
          <label>
            Display name{' '}
            <span className="muted">(group organizers see this)</span>
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
          <label>
            Phone number <span className="muted">(private, optional)</span>
            <input
              name="phone"
              type="tel"
              value={phone}
              autoComplete="tel"
              maxLength={30}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        </div>
        <div className="account-form-actions">
          <button
            type="submit"
            className="button"
            aria-label="Save display name"
            disabled={!dirty || pending}
          >
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
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
