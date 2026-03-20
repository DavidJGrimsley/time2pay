import * as queries from '@/database/local/core/queries';

export const getDb = queries.getDb;
export const initializeDatabase = queries.initializeDatabase;
export const getCurrentSchemaVersion = queries.getCurrentSchemaVersion;
export const runCoreDbValidationScript = queries.runCoreDbValidationScript;

