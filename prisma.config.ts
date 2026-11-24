import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { migrationDatabaseUrl } from './lib/auth/configuration';

for (const file of ['.env.local', '.env'])
  if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: migrationDatabaseUrl() },
});
