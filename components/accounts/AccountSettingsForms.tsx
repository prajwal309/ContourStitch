'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import {
  signOutOtherSessions,
  updateAccountPreferences,
  updateProfilePicture,
  updateAccountUsername,
} from '@/lib/accounts/actions';
import { changePassword } from '@/lib/auth/password-actions';
import Image from 'next/image';

function PictureUploadForm({
  submit,
  pending,
  hasPicture,
}: {
  submit: (formData: FormData) => void;
  pending: boolean;
  hasPicture: boolean;
}) {
  const [selected, setSelected] = useState(false);

  return (
    <form action={submit} className="account-picture-upload">
      <label>
        Choose a profile picture
        <input
          name="picture"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            setSelected(Boolean(event.target.files?.length));
          }}
        />
      </label>
      <p className="muted">
        PNG, JPEG, or WebP up to 200 KB. This profile image is uploaded only
        when you choose it; measurement photos stay on your device.
      </p>
      <div className="account-action-row">
        <button
          className="secondary-button"
          type="submit"
          disabled={!selected || pending}
        >
          {pending ? 'Saving…' : 'Save picture'}
        </button>
        {hasPicture && (
          <button
            className="text-button delete-button"
            type="submit"
            name="removePicture"
            value="on"
            disabled={pending}
          >
            Remove picture
          </button>
        )}
      </div>
    </form>
  );
}

export function ProfilePictureForm({
  userId,
  initialImage,
}: {
  userId: string;
  initialImage: string | null;
}) {
  const [state, submit, pending] = useActionState(
    updateProfilePicture.bind(null, userId),
    { image: initialImage },
  );
  const image = Object.hasOwn(state, 'image') ? state.image : initialImage;
  const inlineImage =
    image?.startsWith('data:image/png;base64,') ||
    image?.startsWith('data:image/jpeg;base64,') ||
    image?.startsWith('data:image/webp;base64,')
      ? image
      : null;

  return (
    <div className="account-picture">
      {inlineImage ? (
        <Image
          src={inlineImage}
          alt="Your profile picture"
          width={64}
          height={64}
          unoptimized
          className="account-avatar-image"
        />
      ) : (
        <span
          className="account-avatar account-avatar-large"
          aria-hidden="true"
        >
          CS
        </span>
      )}
      <div className="account-picture-controls">
        <PictureUploadForm
          key={state.savedAt ?? 'new'}
          submit={submit}
          pending={pending}
          hasPicture={Boolean(image)}
        />
        {state.error && (
          <p role="alert" className="error">
            {state.error}
          </p>
        )}
        {state.saved && <p role="status">Profile picture saved.</p>}
      </div>
    </div>
  );
}

export function PreferencesForm({
  userId,
  measurementUnit,
  fitPreference,
}: {
  userId: string;
  measurementUnit: 'cm' | 'in';
  fitPreference: 'slim' | 'regular' | 'relaxed';
}) {
  const initial = { measurementUnit, fitPreference };
  const [values, setValues] = useState(initial);
  const [state, submit, pending] = useActionState(
    updateAccountPreferences.bind(null, userId),
    { savedValues: initial },
  );
  const savedValues = state.savedValues ?? initial;
  const dirty =
    values.measurementUnit !== savedValues.measurementUnit ||
    values.fitPreference !== savedValues.fitPreference;

  return (
    <form action={submit} className="studio-form">
      <fieldset disabled={pending} className="account-form-grid">
        <label>
          Measurement units
          <select
            name="measurementUnit"
            value={values.measurementUnit}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                measurementUnit: event.target.value === 'in' ? 'in' : 'cm',
              }))
            }
          >
            <option value="cm">Centimetres</option>
            <option value="in">Inches</option>
          </select>
        </label>
        <label>
          Preferred garment fit
          <select
            name="fitPreference"
            value={values.fitPreference}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                fitPreference:
                  event.target.value === 'slim' ||
                  event.target.value === 'relaxed'
                    ? event.target.value
                    : 'regular',
              }))
            }
          >
            <option value="slim">Slim</option>
            <option value="regular">Regular</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
      </fieldset>
      <p className="muted">
        English is currently the only available interface language.
      </p>
      <div className="account-form-actions">
        <button className="button" type="submit" disabled={!dirty || pending}>
          {pending ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="status-message">
          Preferences saved.
        </p>
      )}
    </form>
  );
}

export function UsernameForm({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [value, setValue] = useState(username);
  const initial = { savedUsername: username };
  const formRef = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState(
    updateAccountUsername.bind(null, userId),
    initial,
  );

  useEffect(() => {
    if (state.saved) {
      const passwordInput = formRef.current?.querySelector<HTMLInputElement>(
        '[name="currentPassword"]',
      );
      if (passwordInput) passwordInput.value = '';
    }
  }, [state.saved]);
  const savedValue = state.savedUsername ?? username;

  return (
    <form
      action={submit}
      className="studio-form account-security-form"
      ref={formRef}
    >
      <label>
        Username
        <input
          name="username"
          value={value}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          onChange={(event) => setValue(event.target.value)}
          required
        />
      </label>
      <label>
        Current password to confirm
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button
        className="secondary-button"
        type="submit"
        disabled={value === savedValue || pending}
      >
        {pending ? 'Updating…' : 'Update username'}
      </button>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.saved && <p role="status">Username updated.</p>}
    </form>
  );
}

export function ChangePasswordForm({ userId }: { userId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState(
    changePassword.bind(null, userId),
    {},
  );

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state.saved]);

  return (
    <form
      action={submit}
      className="studio-form account-security-form"
      ref={formRef}
    >
      <label>
        Current password
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        New password
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      <p className="muted">
        Use at least 8 characters, including one punctuation or symbol
        character.
      </p>
      <label>
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? 'Updating…' : 'Change password'}
      </button>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status">
          Password updated. Your other sessions and previous recovery code have
          been revoked.
        </p>
      )}
    </form>
  );
}

export function SessionManagementForm({
  userId,
  activeSessionCount,
}: {
  userId: string;
  activeSessionCount: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState(
    signOutOtherSessions.bind(null, userId),
    {},
  );

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state.saved]);

  return (
    <div className="account-session-management">
      <p>
        {activeSessionCount} active session
        {activeSessionCount === 1 ? '' : 's'} on this account.
      </p>
      <form action={submit} className="studio-form" ref={formRef}>
        <label>
          Current password to sign out other sessions
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          className="secondary-button"
          type="submit"
          disabled={pending || activeSessionCount < 2}
        >
          {pending ? 'Signing out…' : 'Sign out other sessions'}
        </button>
        {state.error && (
          <p role="alert" className="error">
            {state.error}
          </p>
        )}
        {state.message && <p role="status">{state.message}</p>}
      </form>
    </div>
  );
}
