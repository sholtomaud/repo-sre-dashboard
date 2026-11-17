// Builds the site the Action ships, into ../dist at the repository root:
// relative asset paths (the Action sets <base href> when it publishes) and
// no data (the Action writes each repository's own).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, '..', 'dist');
execFileSync('node', ['scripts/sync-data.ts'], { cwd: root, stdio: 'inherit' });
execFileSync(
  'npx',
  ['vite', 'build', '--base', './', '--outDir', out, '--emptyOutDir'],
  {
    cwd: root,
    stdio: 'inherit',
  }
);
fs.rmSync(path.join(out, 'data'), { recursive: true, force: true });
// Pages runs Jekyll unless told not to, and Jekyll hides some files.
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`build-action: wrote ${path.relative(process.cwd(), out)}`);
