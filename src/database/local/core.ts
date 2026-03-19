import * as legacy from '@/database/local/legacy';

export const getDb = legacy.getDb;
export const initializeDatabase = legacy.initializeDatabase;
export const getCurrentSchemaVersion = legacy.getCurrentSchemaVersion;
export const runCoreDbValidationScript = legacy.runCoreDbValidationScript;

