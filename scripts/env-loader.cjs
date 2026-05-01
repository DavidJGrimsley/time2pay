const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const DEFAULT_ENV_FILE_CANDIDATES = ['.env', '.env.test', '.env.production'];

function findFirstEnvFile(options = {}) {
  const cwd = options.cwd || process.cwd();
  const candidates = options.candidates || DEFAULT_ENV_FILE_CANDIDATES;

  for (const fileName of candidates) {
    const filePath = path.resolve(cwd, fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { sourceFile: fileName, sourcePath: filePath };
    }
  }

  return { sourceFile: null, sourcePath: null };
}

function readFirstEnvFile(options = {}) {
  const found = findFirstEnvFile(options);
  if (!found.sourcePath) {
    return { ...found, envFromFile: {} };
  }

  const envFromFile = dotenv.parse(fs.readFileSync(found.sourcePath, 'utf8'));
  return { ...found, envFromFile };
}

function loadFirstEnvFile(options = {}) {
  const {
    override = false,
    prefix = '[env]',
    logger = console.log,
    silent = false,
  } = options;
  const found = findFirstEnvFile(options);

  if (!found.sourcePath) {
    if (!silent && typeof logger === 'function') {
      logger(
        `${prefix} No env file found (checked ${DEFAULT_ENV_FILE_CANDIDATES.join(', ')}).`,
      );
    }
    return { ...found, envFromFile: {} };
  }

  const result = dotenv.config({ path: found.sourcePath, override, quiet: true });
  if (!silent && typeof logger === 'function') {
    logger(`${prefix} Loaded ${found.sourceFile}`);
  }

  if (result.error) {
    throw result.error;
  }

  return { ...found, envFromFile: result.parsed || {} };
}

module.exports = {
  DEFAULT_ENV_FILE_CANDIDATES,
  findFirstEnvFile,
  loadFirstEnvFile,
  readFirstEnvFile,
};
