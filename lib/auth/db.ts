import 'server-only';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalDatabase = globalThis as typeof globalThis & {
  contourStitchPrisma?: PrismaClient;
};

export function databaseUrl() {
  return process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
}

export function database() {
  const connectionString = databaseUrl();
  if (!connectionString) throw new Error('Database configuration missing.');

  globalDatabase.contourStitchPrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 2,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
    }),
  });
  return globalDatabase.contourStitchPrisma;
}
