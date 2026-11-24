import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  database: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/auth/db', () => ({ database: mocks.database }));

import { GET } from '@/app/api/health/database/route';

describe('database health route', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires an authenticated account and never queries for anonymous users', async () => {
    mocks.currentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: 'unauthorized' });
    expect(mocks.database).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('runs a lightweight query and returns only a generic success status', async () => {
    const query = vi.fn().mockResolvedValue([{ ready: true }]);
    mocks.currentUser.mockResolvedValue({ id: 'user-id' });
    mocks.database.mockReturnValue({ $queryRaw: query });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledOnce();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('hides connection and database errors from the response', async () => {
    mocks.currentUser.mockResolvedValue({ id: 'user-id' });
    mocks.database.mockReturnValue({
      $queryRaw: vi
        .fn()
        .mockRejectedValue(new Error('postgres://private-credential')),
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
});
