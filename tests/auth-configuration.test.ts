import { describe, expect, it } from 'vitest';
import {
  databaseUrl,
  inspectAuthConfiguration,
  migrationDatabaseUrl,
} from '@/lib/auth/configuration';

const database = 'postgresql://localhost/contourstitch_test';
const configured = {
  AUTH_URL: 'http://localhost:3000/api/auth',
  AUTH_SECRET: 'test-only-secret'.repeat(3),
  AUTH_GOOGLE_ID: 'test-google-client',
  AUTH_GOOGLE_SECRET: 'test-google-secret',
  DATABASE_URL: database,
};

describe('sign-in deployment configuration', () => {
  it('explains why a deployment with only PostgreSQL cannot start OAuth', () => {
    const config = inspectAuthConfiguration({ DATABASE_URL: database });
    expect(config.origin).toBeNull();
    expect(config.providers).toEqual({ google: false, facebook: false });
    expect(config.problems.join(' ')).toMatch(
      /AUTH_URL.*AUTH_SECRET.*AUTH_GOOGLE_ID.*AUTH_FACEBOOK_ID/,
    );
  });

  it('accepts the Auth.js base path and enables a complete provider independently', () => {
    expect(inspectAuthConfiguration(configured)).toEqual({
      origin: 'http://localhost:3000',
      secure: false,
      providers: { google: true, facebook: false },
      problems: [],
    });
    const facebook = inspectAuthConfiguration({
      ...configured,
      AUTH_GOOGLE_SECRET: ' ',
      AUTH_FACEBOOK_ID: 'test-facebook-client',
      AUTH_FACEBOOK_SECRET: 'test-facebook-secret',
    });
    expect(facebook.providers).toEqual({ google: false, facebook: true });
    expect(facebook.problems).toEqual([]);
  });

  it('uses the Vercel project domain only in production and keeps explicit configuration authoritative', () => {
    const env = {
      ...configured,
      AUTH_URL: undefined,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'contourstitch.example',
      VERCEL_URL: 'deployment-preview.example',
    };
    expect(inspectAuthConfiguration(env)).toMatchObject({
      origin: 'https://contourstitch.example',
      secure: true,
      problems: [],
    });
    expect(
      inspectAuthConfiguration({ ...env, VERCEL_ENV: 'preview' }).origin,
    ).toBeNull();
    expect(
      inspectAuthConfiguration({ ...env, AUTH_URL: 'https://custom.example' })
        .origin,
    ).toBe('https://custom.example');
    expect(
      inspectAuthConfiguration({
        ...env,
        AUTH_URL: 'https://custom.example/sign-in',
      }).problems[0],
    ).toContain('AUTH_URL');
    expect(
      inspectAuthConfiguration({ ...env, AUTH_URL: 'http://localhost:3000' })
        .problems[0],
    ).toContain('HTTPS');
  });

  it('prefers the pooled URL and only reports the variable name for an invalid URL', () => {
    const env = { ...configured, DATABASE_URL_POOLED: 'invalid-test-value' };
    expect(databaseUrl(env)).toBe('invalid-test-value');
    expect(inspectAuthConfiguration(env).problems).toEqual([
      'DATABASE_URL_POOLED must contain a PostgreSQL connection URL',
    ]);
    expect(databaseUrl({ ...env, DATABASE_URL_POOLED: ' ' })).toBe(database);
  });

  it('uses Vercel Postgres variables for runtime and direct migration connections', () => {
    const pooled = 'postgresql://localhost/pooled';
    const direct = 'postgresql://localhost/direct';
    const env = {
      ...configured,
      DATABASE_URL: undefined,
      POSTGRES_PRISMA_URL: pooled,
      POSTGRES_URL_NON_POOLING: direct,
    };
    expect(databaseUrl(env)).toBe(pooled);
    expect(migrationDatabaseUrl(env)).toBe(direct);
    expect(inspectAuthConfiguration(env).problems).toEqual([]);
    expect(
      databaseUrl({
        ...configured,
        DATABASE_URL_POOLED: undefined,
        DATABASE_URL: undefined,
        POSTGRES_PRISMA_URL: undefined,
        POSTGRES_URL: pooled,
      }),
    ).toBe(pooled);
  });
});
