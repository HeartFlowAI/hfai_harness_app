const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
for (const folder of ['src', 'scripts', 'test']) {
  for (const name of fs.readdirSync(folder)) {
    if (!name.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(folder, name)], { encoding: 'utf8' });
    if (result.status) { process.stderr.write(result.stderr); process.exit(1); }
  }
}
console.log('JavaScript syntax checks passed.');
