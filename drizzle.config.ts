import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl =
  process.env.DRIZZLE_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.DATABASE_DIRECT_URL?.trim() ||
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
