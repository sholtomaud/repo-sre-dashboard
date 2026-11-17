// Copies the sample data into public/data, where the dashboard fetches it
// during development and the end-to-end tests. Runs before `dev` and
// `build`. The Action's prebuilt site leaves public/data out (see
// scripts/build-action.ts): each repository's tracker writes its own.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const from = path.join(root, 'sample-data');
const to = path.join(root, 'public', 'data');
fs.mkdirSync(to, { recursive: true });
for (const name of [
  'data.csv',
  'agent_queue.csv',
  'status.json',
  'config.json',
]) {
  fs.copyFileSync(path.join(from, name), path.join(to, name));
}
console.log('sync-data: copied the sample data');
