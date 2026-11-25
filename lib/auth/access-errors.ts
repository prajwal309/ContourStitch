import 'server-only';

import { randomUUID } from 'node:crypto';

const schemaCodes = new Set([
  'P1014',
  'P2021',
  'P2022',
  '42P01',
  '42703',
  'TableDoesNotExist',
  'ColumnNotFound',
  'ColumnDoesNotExist',
]);
const databaseCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1010',
  'P1011',
  'P1017',
  'P2024',
  'P2028',
  '08001',
  '08003',
  '08006',
  '28P01',
  '42501',
  '53300',
  '57P01',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
]);
const adapterFailures = new Set([
  'DatabaseNotReachable',
  'AuthenticationFailed',
  'TlsConnectionError',
  'ConnectionClosed',
  'DatabaseDoesNotExist',
  'DatabaseAccessDenied',
  'SocketTimeout',
  'PoolUpstreamUnavailable',
]);

export const configurationFeedback = {
  error:
    'Account sign-in is not configured for this deployment. You can continue as a guest.',
};

function fields(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function accountFailure(operation: string, error: unknown) {
  const reference = randomUUID().slice(0, 8);
  const top = fields(error);
  const meta = fields(top.meta);
  const causes = [
    fields(top.cause),
    fields(fields(meta.driverAdapterError).cause),
  ];
  const codes = [
    top.code,
    top.errorCode,
    meta.code,
    ...causes.flatMap(({ kind, code, originalCode }) => [
      kind,
      code,
      originalCode,
    ]),
  ].filter((code): code is string => typeof code === 'string');

  if (
    [top.message, ...causes.map((cause) => cause.originalMessage)].some(
      (value) =>
        typeof value === 'string' &&
        /^Failed to connect to upstream database\b/i.test(value),
    )
  )
    codes.push('PoolUpstreamUnavailable');

  const schema = codes.some((code) => schemaCodes.has(code));
  const connection = codes.some(
    (code) => databaseCodes.has(code) || adapterFailures.has(code),
  );
  const safeCodes = [
    ...new Set(
      codes.filter(
        (code) =>
          /^P\d{4}$/.test(code) ||
          schemaCodes.has(code) ||
          databaseCodes.has(code) ||
          adapterFailures.has(code),
      ),
    ),
  ];
  console.error('ContourStitch account failure', {
    operation,
    reference,
    codes: safeCodes,
  });

  if (schema)
    return {
      error: `The account database setup is incomplete. Contact support with reference ${reference} or continue as a guest.`,
    };
  if (codes.includes('PoolUpstreamUnavailable'))
    return {
      error: `The account database pooler cannot reach the database. Contact support with reference ${reference} or try again shortly.`,
    };
  if (connection)
    return {
      error: `The account database is unreachable or refused access. Try again shortly or contact support with reference ${reference}.`,
    };
  return {
    error: `We couldn’t finish that account request. Try again or contact support with reference ${reference}.`,
  };
}
