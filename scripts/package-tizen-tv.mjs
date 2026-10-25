#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const script = resolve(root, 'scripts/package-tizen-tv.py');
const forwarded = process.argv.slice(2);
const configuredPython = process.env.PYTHON;

const candidates = [];
if (configuredPython) candidates.push([configuredPython, []]);
if (process.platform === 'win32') {
  candidates.push(['py', ['-3']], ['python', []], ['python3', []]);
} else {
  candidates.push(['python3', []], ['python', []], ['py', ['-3']]);
}

let foundPython = false;
for (const [command, prefixArgs] of candidates) {
  if (!command) continue;
  const result = spawnSync(command, [...prefixArgs, script, ...forwarded], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error?.code === 'ENOENT') continue;
  if (result.error) {
    console.error('[TV package] Could not start Python:', result.error.message);
    process.exit(1);
  }

  foundPython = true;
  process.exit(result.status ?? 1);
}

if (!foundPython) {
  console.error('[TV package] Python 3 is required. Install Python 3 or set the PYTHON environment variable, then rerun this command.');
  process.exit(1);
}
