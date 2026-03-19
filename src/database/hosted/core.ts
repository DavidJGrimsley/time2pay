import * as repository from '@/database/hosted/repository';

export const getDb = repository.getDb;
export const initializeDatabase = repository.initializeDatabase;
export const getCurrentSchemaVersion = repository.getCurrentSchemaVersion;
export const runCoreDbValidationScript = repository.runCoreDbValidationScript;

