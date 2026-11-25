import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/password-actions', () => ({
  submitPassword: vi.fn(),
}));
vi.mock('@/lib/auth/recovery-actions', () => ({
  recoverPassword: vi.fn(),
}));

import { PasswordForm } from '@/components/accounts/PasswordForm';

it('shows concise username guidance only during registration', () => {
  const { rerender } = render(<PasswordForm mode="register" next="/account" />);
  const guidance = 'Choose a username with 3–32 characters.';

  expect(screen.getByText(guidance)).toBeVisible();
  expect(screen.getByLabelText('Username')).toHaveAttribute(
    'aria-describedby',
    'username-rules',
  );

  rerender(<PasswordForm mode="sign-in" next="/account" />);
  expect(screen.queryByText(guidance)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Username')).not.toHaveAttribute(
    'aria-describedby',
  );
});
