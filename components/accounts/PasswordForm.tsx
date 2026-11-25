'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitPassword } from '@/lib/auth/password-actions';
import { recoverPassword } from '@/lib/auth/recovery-actions';
import { RegistrationAgreementFields } from '@/components/consent/AgreementFields';
import { PasswordInput } from './PasswordInput';

export function PasswordForm({
  mode,
  next,
}: {
  mode: 'register' | 'sign-in' | 'recover';
  next: string;
}) {
  const [state, action, pending] = useActionState(
    mode === 'recover'
      ? recoverPassword.bind(null, next)
      : submitPassword.bind(null, mode, next),
    {},
  );
  const newPassword = mode !== 'sign-in';
  const label = {
    register: 'Create account',
    'sign-in': 'Sign in',
    recover: 'Reset password',
  }[mode];

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
          aria-describedby={mode === 'register' ? 'username-rules' : undefined}
          required
        />
        {mode === 'register' && (
          <p className="muted" id="username-rules">
            3–32 letters, numbers, dots, underscores, or hyphens. Start with a
            letter or number.
          </p>
        )}
      </div>
      {mode === 'recover' && (
        <div className="password-field">
          <label htmlFor="account-recovery-code">Recovery code</label>
          <input
            id="account-recovery-code"
            name="recovery-code"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={64}
            required
          />
        </div>
      )}
      <PasswordInput
        label={mode === 'recover' ? 'New password' : 'Password'}
        autoComplete={newPassword ? 'new-password' : 'current-password'}
        validateLength={newPassword}
      />
      {newPassword && (
        <PasswordInput
          label={
            mode === 'recover' ? 'Confirm new password' : 'Confirm password'
          }
          name="confirm-password"
          autoComplete="new-password"
        />
      )}
      {mode === 'register' && <RegistrationAgreementFields />}
      {mode === 'sign-in' && (
        <Link
          className="text-button password-recovery-link"
          href={`/sign-in?mode=recover&next=${encodeURIComponent(next)}`}
        >
          Forgot password?
        </Link>
      )}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {pending ? 'Please wait…' : label}
      </button>
    </form>
  );
}
