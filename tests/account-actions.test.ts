import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: vi.fn(),
  leaveAccount: vi.fn(),
  hasAccountAgreements: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/auth/db', () => ({ database: mocks.database }));
vi.mock('@/lib/auth/actions', () => ({ leaveAccount: mocks.leaveAccount }));
vi.mock('@/lib/consent/store', () => ({
  hasAccountAgreements: mocks.hasAccountAgreements,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { updateProfilePicture } from '@/lib/accounts/actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: 'user-1' });
  mocks.updateUser.mockResolvedValue({});
  mocks.database.mockReturnValue({
    user: { update: mocks.updateUser },
  });
});

it('stores an explicitly selected, valid small image and revalidates the account', async () => {
  const png = new File(
    [
      Uint8Array.from(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0yAAAAAASUVORK5CYII=',
          'base64',
        ),
      ),
    ],
    'avatar.png',
    { type: 'image/png' },
  );
  const form = new FormData();
  form.set('picture', png);

  const result = await updateProfilePicture('user-1', {}, form);

  expect(result.saved).toBe(true);
  expect(result.image).toMatch(/^data:image\/png;base64,/);
  expect(mocks.updateUser).toHaveBeenCalledWith({
    where: { id: 'user-1' },
    data: { image: result.image },
  });
  expect(mocks.revalidatePath).toHaveBeenCalledWith('/account');
});

it('rejects spoofed image content without persisting it', async () => {
  const file = new File(['not an image'], 'avatar.png', {
    type: 'image/png',
  });
  const form = new FormData();
  form.set('picture', file);

  await expect(updateProfilePicture('user-1', {}, form)).resolves.toEqual({
    error: 'Use a valid PNG, JPEG, or WebP image.',
  });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

it('rejects image updates when the signed-in user does not own the account', async () => {
  mocks.currentUser.mockResolvedValue({ id: 'someone-else' });
  const form = new FormData();
  form.set('picture', new File(['data'], 'avatar.png', { type: 'image/png' }));

  await expect(updateProfilePicture('user-1', {}, form)).resolves.toEqual({
    error: 'Your session changed. Sign in again to continue.',
  });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
