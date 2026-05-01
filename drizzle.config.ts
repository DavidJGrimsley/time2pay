import { createRequire } from 'node:module';
import { defineConfig } from 'drizzle-kit';

const require = createRequire(import.meta.url);
const { loadFirstEnvFile } = require('./scripts/env-loader.cjs') as {
  loadFirstEnvFile: (options?: {
    cwd?: string;
    prefix?: string;
    logger?: (message: string) => void;
  }) => void;
};

loadFirstEnvFile({ cwd: process.cwd(), prefix: '[drizzle]' });

const databaseUrl =
  process.env.DATABASE_DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  'postgresql://postgres:postgres@localhost:5432/postgres';

export default defineConfig({
  schema: './src/database/hosted/**/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
