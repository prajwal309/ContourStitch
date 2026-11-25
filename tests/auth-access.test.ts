import { Prisma } from '@prisma/client';
import { afterEach, expect, it, vi } from 'vitest';
import { accountFailure } from '@/lib/auth/access-errors';
import { newRecoveryCode, recoveryCodeHash } from '@/lib/auth/recovery-code';

afterEach(() => vi.restoreAllMocks());

it('distinguishes schema and connection failures while keeping error text out of logs', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const raw = new Prisma.PrismaClientKnownRequestError(
    'private password and hostname',
    {
      code: 'P2010',
      clientVersion: 'test',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'TableDoesNotExist',
            originalCode: '42P01',
            originalMessage: 'private table',
          },
        },
      },
    },
  );
  expect(accountFailure('sign-in-password', raw).error).toMatch(
    /database setup is incomplete.*reference [a-f0-9]{8}/,
  );
  expect(
    accountFailure(
      'sign-in-password',
      new Prisma.PrismaClientKnownRequestError('private password', {
        code: 'P2010',
        clientVersion: 'test',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'DatabaseNotReachable',
              host: 'private address',
            },
          },
        },
      }),
    ).error,
  ).toMatch(/database is unreachable or refused access/);
  expect(
    accountFailure(
      'sign-in-password',
      new Error(
        'Failed to connect to upstream database. private service details',
      ),
    ).error,
  ).toMatch(/database pooler cannot reach/);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
});

it('generates a random recoverable code and normalizes only presentation separators and case', () => {
  const first = newRecoveryCode();
  expect(first).toMatch(/^(?:[a-f0-9]{8}-){3}[a-f0-9]{8}$/);
  expect(newRecoveryCode()).not.toBe(first);
  expect(recoveryCodeHash(first)).toMatch(/^[a-f0-9]{64}$/);
  expect(recoveryCodeHash(first.replaceAll('-', '').toUpperCase())).toBe(
    recoveryCodeHash(first),
  );
  expect(recoveryCodeHash('guess')).toBeNull();
});
