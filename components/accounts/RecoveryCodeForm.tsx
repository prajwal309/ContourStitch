'use client';

import { useActionState } from 'react';
import { issueRecoveryCode } from '@/lib/auth/recovery-actions';
import { PasswordInput } from './PasswordInput';

export function RecoveryCodeForm({
  userId,
  hasCode,
}: {
  userId: string;
  hasCode: boolean;
}) {
  const [state, action, pending] = useActionState(
    issueRecoveryCode.bind(null, userId),
    {},
  );

  return (
    <details className="studio-section">
      <summary>Recovery code</summary>
      <p>
        Save a one-time code somewhere secure to reset your password if you
        forget it. Generating a code replaces your previous one.
      </p>
      {state.code ? (
        <div role="status" className="recovery-code">
          <p>Copy this code now. It’s displayed once.</p>
          <code>{state.code}</code>
        </div>
      ) : (
        <form className="studio-form agreement-flow" action={action}>
          <PasswordInput label="Current password" />
          {state.error && (
            <p role="alert" className="error">
              {state.error}
            </p>
          )}
          <button className="secondary-button" type="submit" disabled={pending}>
            {pending
              ? 'Generating…'
              : hasCode
                ? 'Replace recovery code'
                : 'Generate recovery code'}
          </button>
        </form>
      )}
    </details>
  );
}
