'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import {
  passwordLengthMessage,
  passwordMaxCodeUnits,
  passwordValidationMessage,
} from '@/lib/auth/password-policy';

export function PasswordInput({
  label,
  name = 'password',
  autoComplete = 'current-password',
  validateLength = false,
}: {
  label: string;
  name?: string;
  autoComplete?: 'current-password' | 'new-password';
  validateLength?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={passwordMaxCodeUnits}
          aria-describedby={validateLength ? `${id}-rules` : undefined}
          required
          onInput={
            validateLength
              ? ({ currentTarget }) =>
                  currentTarget.setCustomValidity(
                    currentTarget.value
                      ? passwordValidationMessage(currentTarget.value)
                      : '',
                  )
              : undefined
          }
        />
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          <Icon size={19} aria-hidden="true" />
        </button>
      </div>
      {validateLength && (
        <p className="muted" id={`${id}-rules`}>
          {passwordLengthMessage}
        </p>
      )}
    </div>
  );
}
