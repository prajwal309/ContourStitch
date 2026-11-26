import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateAccountPreferences: vi.fn(),
  updateAccountUsername: vi.fn(),
  updateDisplayName: vi.fn(),
  signOutOtherSessions: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock('@/lib/accounts/actions', () => ({
  updateAccountPreferences: mocks.updateAccountPreferences,
  updateAccountUsername: mocks.updateAccountUsername,
  updateDisplayName: mocks.updateDisplayName,
  signOutOtherSessions: mocks.signOutOtherSessions,
}));
vi.mock('@/lib/auth/password-actions', () => ({
  changePassword: mocks.changePassword,
}));

import { DisplayNameForm } from '@/components/accounts/DisplayNameForm';
import { PreferencesForm } from '@/components/accounts/AccountSettingsForms';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateAccountPreferences.mockImplementation(
    async (_userId: string, _previous: unknown, form: FormData) => ({
      saved: true,
      savedValues: {
        measurementUnit: form.get('measurementUnit'),
        fitPreference: form.get('fitPreference'),
      },
    }),
  );
  mocks.updateDisplayName.mockImplementation(
    async (_userId: string, _previous: unknown, form: FormData) => ({
      saved: true,
      savedValues: {
        name: form.get('displayName'),
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        phone: form.get('phone'),
      },
    }),
  );
});

it('keeps the preferences save disabled until a setting changes and confirms the save', async () => {
  render(
    <PreferencesForm
      userId="user-1"
      measurementUnit="cm"
      fitPreference="regular"
    />,
  );
  const save = screen.getByRole('button', { name: 'Save preferences' });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Measurement units'), {
    target: { value: 'in' },
  });
  expect(save).toBeEnabled();
  fireEvent.submit(save.closest('form')!);

  await waitFor(() => {
    expect(mocks.updateAccountPreferences).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Preferences saved.');
    expect(save).toBeDisabled();
  });
});

it('keeps profile changes dirty until saved and includes private fields in the update', async () => {
  render(
    <DisplayNameForm
      userId="user-1"
      initialName="Contour guest"
      initialFirstName="Alex"
      initialLastName="Guest"
      initialPhone=""
    />,
  );
  const save = screen.getByRole('button', { name: 'Save display name' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Phone number/), {
    target: { value: '+1 555 010 1234' },
  });
  expect(save).toBeEnabled();
  fireEvent.submit(save.closest('form')!);

  await waitFor(() => {
    expect(mocks.updateDisplayName).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Display name saved.');
    expect(save).toBeDisabled();
  });
});
