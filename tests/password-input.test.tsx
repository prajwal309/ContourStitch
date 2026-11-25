import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PasswordInput } from '@/components/accounts/PasswordInput';
import {
  passwordLengthMessage,
  passwordMaxLengthMessage,
} from '@/lib/auth/password-policy';

it('shows the active password guidance and accepts passphrases', () => {
  render(
    <PasswordInput
      label="New password"
      autoComplete="new-password"
      validateLength
    />,
  );
  const input = screen.getByLabelText('New password') as HTMLInputElement;

  expect(input).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByText(passwordLengthMessage)).toBeVisible();
  fireEvent.input(input, { target: { value: 'too short' } });
  expect(input.validity.customError).toBe(true);
  expect(input.validationMessage).toBe(passwordLengthMessage);

  fireEvent.input(input, {
    target: { value: 'A passphrase with spaces! 2026' },
  });
  expect(input.validity.customError).toBe(false);
});

it('enforces the maximum without adding character composition rules', () => {
  render(<PasswordInput label="New password" validateLength />);
  const input = screen.getByLabelText('New password') as HTMLInputElement;

  fireEvent.input(input, { target: { value: 'a'.repeat(129) } });
  expect(input.validity.customError).toBe(true);
  expect(input.validationMessage).toBe(passwordMaxLengthMessage);

  fireEvent.input(input, {
    target: { value: 'a'.repeat(15) },
  });
  expect(input.validity.customError).toBe(false);
});

it('keeps entered text when toggling password visibility', () => {
  render(<PasswordInput label="Password" />);
  const input = screen.getByLabelText('Password') as HTMLInputElement;
  fireEvent.input(input, { target: { value: 'A passphrase 123!' } });

  expect(input).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('A passphrase 123!');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(input).toHaveAttribute('type', 'password');
});
