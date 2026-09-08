const fs = require('node:fs');

const WORKER_CHUNK_ASSERT =
  '(0, assert_1.default)(asyncChunks.size, `Worker chunk not found for: ${dependency.absolutePath}`);';
const WORKER_CHUNK_GUARD = `if (!asyncChunks.size) {
                        continue;
                    }`;

function patchMetroSqliteWorkerSerializer() {
  const file = require.resolve('@expo/metro-config/build/serializer/serializeChunks.js');
  const source = fs.readFileSync(file, 'utf8');

  if (source.includes(WORKER_CHUNK_GUARD) || !source.includes(WORKER_CHUNK_ASSERT)) {
    return;
  }

  fs.writeFileSync(file, source.replace(WORKER_CHUNK_ASSERT, WORKER_CHUNK_GUARD));
  delete require.cache[file];
}

module.exports = { patchMetroSqliteWorkerSerializer };
