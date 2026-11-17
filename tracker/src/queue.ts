/**
 * An optional file-based issue queue, as some agentic projects keep: one
 * folder of open issues and one of resolved ones, in a git repository. For
 * each day the queue counts the files in both folders at that day's last
 * commit, and how many resolved files were added by people rather than
 * automation. Only folder listings and commit authors are read, from a
 * commits-only clone.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCsv, writeCsv } from './csv.ts';
import { AGENT_WORDS } from './issues.ts';

export interface QueueConfig {
  /** owner/name of the repository holding the folders. */
  repository: string;
  openDir: string;
  resolvedDir: string;
  /** e.g. https://github.com */
  serverUrl: string;
  token?: string;
}

export interface QueueRow {
  date: string;
  open: number;
  resolved: number;
  resolved_by_human: number;
}

export const QUEUE_FIELDS = [
  'date',
  'open',
  'resolved',
  'resolved_by_human',
] as const;

const git = (args: string[], cwd?: string) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

/** Whether a commit author is automation rather than a person. */
export function isAutomationAuthor(name: string, email: string): boolean {
  const who = name.toLowerCase();
  return (
    `${who} ${email.toLowerCase()}`.includes('[bot]') ||
    AGENT_WORDS.some((word) => who.includes(word)) ||
    /scaffolder|migration/.test(who)
  );
}

const withSlash = (dir: string) => (dir.endsWith('/') ? dir : `${dir}/`);

/**
 * Brings `file` (agent_queue.csv) up to date. Days already recorded are
 * kept, except today, which is still moving. Returns the latest row, or
 * `null` if the repository could not be read.
 */
export function updateQueue(
  config: QueueConfig,
  file: string,
  now: Date
): QueueRow | null {
  const rows = new Map(readCsv(file).map((r) => [r.date, r]));
  const today = now.toISOString().slice(0, 10);
  const openDir = withSlash(config.openDir);
  const resolvedDir = withSlash(config.resolvedDir);
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-queue-'));
  try {
    const auth = config.token
      ? [
          '-c',
          `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${config.token}`).toString('base64')}`,
        ]
      : [];
    git([
      ...auth,
      'clone',
      '--quiet',
      '--bare',
      '--filter=tree:0',
      '--single-branch',
      `${config.serverUrl}/${config.repository}`,
      clone,
    ]);
    const first = git(
      ['log', '--reverse', '--format=%cI', 'HEAD'],
      clone
    ).split('\n')[0];
    let day = new Date(
      `${new Date(first).toISOString().slice(0, 10)}T00:00:00Z`
    );
    let humanTotal = 0;
    for (
      ;
      day.toISOString().slice(0, 10) <= today;
      day = new Date(day.getTime() + 86_400_000)
    ) {
      const date = day.toISOString().slice(0, 10);
      const recorded = rows.get(date);
      if (recorded && date !== today && recorded.resolved_by_human !== '') {
        humanTotal = Number(recorded.resolved_by_human);
        continue;
      }
      const end = date === today ? now : new Date(day.getTime() + 86_399_000);
      const stamp = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
      const commit = git(
        ['rev-list', '-1', `--before=${stamp(end)}`, 'HEAD'],
        clone
      ).trim();
      if (!commit) continue;
      const files = git(
        ['ls-tree', '-r', '--name-only', commit, openDir, resolvedDir],
        clone
      )
        .split('\n')
        .filter(Boolean);
      const count = (dir: string) =>
        files.filter((f) => f.startsWith(dir) && !f.endsWith('/.gitkeep'))
          .length;
      const authored = git(
        [
          'log',
          '--no-merges',
          `--since=${stamp(day)}`,
          `--until=${stamp(end)}`,
          '--format=%H%x09%an%x09%ae',
          'HEAD',
        ],
        clone
      )
        .split('\n')
        .filter(Boolean);
      for (const line of authored) {
        const [sha, name, email] = line.split('\t');
        if (isAutomationAuthor(name, email)) continue;
        humanTotal += git(
          ['show', '--name-status', '--format=', sha, '--', resolvedDir],
          clone
        )
          .split('\n')
          .filter((l) => l.startsWith('A')).length;
      }
      rows.set(date, {
        date,
        open: String(count(openDir)),
        resolved: String(count(resolvedDir)),
        resolved_by_human: String(humanTotal),
      });
    }
  } catch (error) {
    console.warn(
      `Could not read the queue in ${config.repository}: ${(error as Error).message}`
    );
    return null;
  } finally {
    fs.rmSync(clone, { recursive: true, force: true });
  }
  const ordered = [...rows.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (ordered.length === 0) return null;
  writeCsv(file, QUEUE_FIELDS, ordered);
  const last = ordered.at(-1)!;
  return {
    date: last.date,
    open: Number(last.open),
    resolved: Number(last.resolved),
    resolved_by_human: Number(last.resolved_by_human),
  };
}
