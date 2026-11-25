const providerVariables = {
  google: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'],
  facebook: ['AUTH_FACEBOOK_ID', 'AUTH_FACEBOOK_SECRET'],
} as const;

type Environment = Readonly<Record<string, string | undefined>>;

const runtimeDatabaseKeys = [
  'DATABASE_URL_POOLED',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'PRISMA_DATABASE_URL',
] as const;

const directDatabaseKeys = [
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL',
  'PRISMA_DATABASE_URL',
] as const;

const migrationDatabaseKeys = [
  ...directDatabaseKeys,
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_POOLED',
] as const;

function runtimeKeys(env: Environment) {
  return env.DATABASE_CONNECTION_MODE?.trim() === 'direct'
    ? directDatabaseKeys
    : runtimeDatabaseKeys;
}

function firstConfigured(
  env: Environment,
  keys: readonly (keyof Environment)[],
) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function configuredDatabaseKey(
  env: Environment,
  keys: readonly (keyof Environment)[],
) {
  return keys.find((key) => Boolean(env[key]?.trim()));
}

function canonicalOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      !['/', '/api/auth', '/api/auth/'].includes(url.pathname) ||
      url.search ||
      url.hash
    )
      return null;
    if (url.protocol === 'https:') return url.origin;
    if (url.protocol === 'http:' && url.hostname === 'localhost')
      return url.origin;
  } catch {
    return null;
  }
  return null;
}

export function databaseUrl(env: Environment = process.env) {
  return firstConfigured(env, runtimeKeys(env));
}

export function migrationDatabaseUrl(env: Environment = process.env) {
  return firstConfigured(env, migrationDatabaseKeys);
}

function isPostgresUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return Boolean(
      url.hostname && ['postgres:', 'postgresql:'].includes(url.protocol),
    );
  } catch {
    return false;
  }
}

export function inspectAuthConfiguration(env: Environment) {
  const deploymentDomain = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelOrigin =
    env.VERCEL === '1' &&
    env.VERCEL_ENV === 'production' &&
    deploymentDomain &&
    /^[a-z0-9.-]+$/i.test(deploymentDomain)
      ? `https://${deploymentDomain}`
      : undefined;
  const origin = canonicalOrigin(env.AUTH_URL?.trim() || vercelOrigin);
  const secure = origin?.startsWith('https://') ?? false;
  const problems: string[] = [];
  if (!origin || (env.VERCEL === '1' && !secure))
    problems.push(
      'AUTH_URL must be a valid application origin (HTTPS on Vercel)',
    );
  if (!isPostgresUrl(databaseUrl(env))) {
    const key = configuredDatabaseKey(env, runtimeKeys(env));
    const expected =
      env.DATABASE_CONNECTION_MODE?.trim() === 'direct'
        ? 'DATABASE_URL or another direct PostgreSQL variable'
        : 'DATABASE_URL or a Vercel Postgres URL';
    problems.push(
      `${key ?? expected} must contain a PostgreSQL connection URL`,
    );
  }

  const providers = {
    google: providerVariables.google.every((key) => Boolean(env[key]?.trim())),
    facebook: providerVariables.facebook.every((key) =>
      Boolean(env[key]?.trim()),
    ),
  };
  const oauthEnabled =
    problems.length === 0 &&
    (providers.google || providers.facebook) &&
    (env.AUTH_SECRET?.trim().length ?? 0) >= 32;
  return { origin, secure, providers, problems, oauthEnabled };
}

export const authConfiguration = inspectAuthConfiguration(process.env);
