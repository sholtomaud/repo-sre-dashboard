/**
 * The whole Action against a stand-in GitHub: a local API server and a local
 * git repository in place of the user's. Runs the real checkout, tracker and
 * publish steps, twice. Needs bash, git and the prebuilt site (dist/).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const hasSite = fs.existsSync(path.join(root, 'dist', 'index.html'));

const issueNode = (number: number, closed: boolean) => ({
  number,
  createdAt: `2026-11-0${number}T00:00:00Z`,
  closedAt: closed ? `2026-11-0${number}T12:00:00Z` : null,
  stateReason: closed ? 'COMPLETED' : null,
  body: '### What happened\nIt broke',
  author: { login: 'reporter' },
  labels: { nodes: number === 1 ? [{ name: 'bug' }] : [] },
  closedEvents: {
    nodes: closed
      ? [
          {
            actor: { login: 'copilot-swe-agent', __typename: 'Bot' },
            closer: { __typename: 'PullRequest', merged: true },
          },
        ]
      : [],
  },
  reopens: { totalCount: 0 },
  firstComments: {
    nodes: [
      {
        author: { login: 'maintainer' },
        createdAt: `2026-11-0${number}T02:00:00Z`,
      },
    ],
  },
  lastComments: { nodes: [] },
});

function startApi(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/graphql') {
      return send(200, {
        data: {
          repository: {
            issues: {
              pageInfo: { hasNextPage: false, endCursor: 'x' },
              nodes: [
                issueNode(1, true),
                issueNode(2, false),
                issueNode(3, false),
              ],
            },
          },
        },
      });
    }
    if (
      req.url?.startsWith(
        '/repos/owner/project/contents/.github/workflows/sre.yml'
      )
    ) {
      const workflow = "on:\n  schedule:\n    - cron: '5 */6 * * *'\n";
      return send(200, { content: Buffer.from(workflow).toString('base64') });
    }
    return send(404, { message: 'Not Found' });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server))
  );
}

test(
  'the Action publishes the dashboard and its data to the Pages branch',
  { skip: !hasSite && 'run npm run build first' },
  async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-action-'));
    const server = await startApi();
    try {
      // The user's repository, with a main branch and no gh-pages yet.
      const remotes = path.join(work, 'remotes');
      const bare = path.join(remotes, 'owner', 'project.git');
      fs.mkdirSync(bare, { recursive: true });
      execFileSync('git', ['init', '--quiet', '--bare', bare]);

      const port = (server.address() as { port: number }).port;
      const run = (script: string, extra: Record<string, string> = {}) => {
        const output = path.join(work, 'output');
        const summary = path.join(work, 'summary');
        const env = {
          ...process.env,
          GITHUB_ACTION_PATH: root,
          GITHUB_REPOSITORY: 'owner/project',
          GITHUB_SERVER_URL: `file://${remotes}`,
          GITHUB_API_URL: `http://127.0.0.1:${port}`,
          GITHUB_WORKFLOW_REF:
            'owner/project/.github/workflows/sre.yml@refs/heads/main',
          GITHUB_OUTPUT: output,
          GITHUB_STEP_SUMMARY: summary,
          RUNNER_TEMP: work,
          SRE_TOKEN: 'test-token',
          SRE_BRANCH: 'gh-pages',
          SRE_PATH: 'dashboard',
          SRE_DATA_DIR: path.join(work, 'sre-pages', 'dashboard', 'data'),
          GIT_AUTHOR_NAME: 'test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
          ...extra,
        };
        const [command, ...args] = script.endsWith('.ts')
          ? ['node', script]
          : ['bash', script];
        // Asynchronous, so this process can keep answering the stand-in API.
        return promisify(execFile)(command, args, {
          env,
          cwd: work,
          encoding: 'utf8',
        }).then((r) => r.stdout);
      };
      const steps = async () => {
        await run(path.join(root, 'scripts', 'checkout-pages.sh'));
        await run(path.join(root, 'tracker', 'src', 'main.ts'));
        return run(path.join(root, 'scripts', 'publish.sh'));
      };

      assert.match(await steps(), /Published to gh-pages:\/dashboard/);
      const files = execFileSync(
        'git',
        ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'gh-pages'],
        { encoding: 'utf8' }
      )
        .split('\n')
        .filter(Boolean);
      for (const file of [
        '.nojekyll',
        'dashboard/index.html',
        'dashboard/methodology/index.html',
        'dashboard/data/data.csv',
        'dashboard/data/status.json',
        'dashboard/data/config.json',
      ]) {
        assert.ok(files.includes(file), `missing ${file}`);
      }
      const show = (file: string) =>
        execFileSync('git', ['--git-dir', bare, 'show', `gh-pages:${file}`], {
          encoding: 'utf8',
        });
      assert.match(
        show('dashboard/index.html'),
        /<base href="\/project\/dashboard\/"/
      );
      const status = JSON.parse(show('dashboard/data/status.json'));
      assert.equal(status.schedule.description, 'every 6 hours');
      assert.equal(status.issues.total, 3);
      assert.equal(status.issues.open, 2);
      assert.ok(
        status.practices.some(
          (p: { id: string; status: string }) =>
            p.id === 'issue-forms' && p.status === 'missing'
        )
      );
      const config = JSON.parse(show('dashboard/data/config.json'));
      assert.equal(config.repository, 'owner/project');
      assert.equal(config.queue, null);
      const csv = show('dashboard/data/data.csv').trim().split('\n');
      assert.match(
        csv[0],
        /^date,open,agent_closed,human_closed,closed_fix_referenced/
      );
      assert.match(
        fs.readFileSync(path.join(work, 'output'), 'utf8'),
        /url=https:\/\/owner\.github\.io\/project\/dashboard\//
      );

      // Other content on the branch is left alone, and a second run updates
      // in place.
      const second = await steps();
      assert.match(second, /Published|No changes to publish/);
      const after = execFileSync(
        'git',
        ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'gh-pages'],
        { encoding: 'utf8' }
      )
        .split('\n')
        .filter(Boolean);
      assert.deepEqual(
        after.filter((f) => f.startsWith('dashboard/assets/')).length,
        files.filter((f) => f.startsWith('dashboard/assets/')).length
      );
    } finally {
      server.close();
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
);
