'use client';

import { useActionState } from 'react';
import { submitPassword } from '@/lib/auth/password-actions';
import { registrationAgreements } from '@/lib/consent/agreements';
import { AgreementFields } from '@/components/consent/AgreementFields';

export function PasswordForm({
  register,
  next,
}: {
  register: boolean;
  next: string;
}) {
  const [state, action, pending] = useActionState(
    submitPassword.bind(null, register ? 'register' : 'sign-in', next),
    {},
  );

  return (
    <form action={action} className="agreement-flow studio-form password-form">
      <div className="password-field">
        <label htmlFor="account-username">Username</label>
        <input
          id="account-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          aria-describedby={register ? 'username-rules' : undefined}
          required
        />
        {register && (
          <p className="muted" id="username-rules">
            Use 3–32 letters, numbers, dots, underscores, or hyphens. Start with
            a letter or number.
          </p>
        )}
      </div>
      <div className="password-field">
        <label htmlFor="account-password">Password</label>
        <input
          id="account-password"
          name="password"
          type="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          maxLength={256}
          aria-describedby={register ? 'password-rules' : undefined}
          required
        />
        {register && (
          <p className="muted" id="password-rules">
            Use 15–128 characters. Save your password somewhere safe. Password
            recovery is currently unavailable.
          </p>
        )}
      </div>
      {register && (
        <>
          <div className="password-field">
            <label htmlFor="account-password-confirmation">
              Confirm password
            </label>
            <input
              id="account-password-confirmation"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              maxLength={256}
              required
            />
          </div>
          <AgreementFields types={registrationAgreements} showOptional />
        </>
      )}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}
