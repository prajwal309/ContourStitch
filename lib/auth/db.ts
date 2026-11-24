import 'server-only';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseUrl } from './configuration';

const globalDatabase = globalThis as typeof globalThis & {
  contourStitchPrisma?: PrismaClient;
};

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
