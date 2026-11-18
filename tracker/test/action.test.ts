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

const config_title = (show: (file: string) => string) =>
  JSON.parse(show('dashboard/data/config.json')).title;

function startApi(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/graphql') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (body.includes('pullRequests')) {
          send(200, {
            data: {
              repository: {
                pullRequests: {
                  pageInfo: { hasNextPage: false, endCursor: 'x' },
                  nodes: [
                    {
                      number: 10,
                      createdAt: '2026-11-02T00:00:00Z',
                      mergedAt: '2026-11-02T05:00:00Z',
                      closedAt: '2026-11-02T05:00:00Z',
                      body: 'Generated with Claude Code',
                      author: { login: 'maintainer', __typename: 'User' },
                      commits: { nodes: [{ commit: { message: 'Fix' } }] },
                    },
                  ],
                },
              },
            },
          });
          return;
        }
        send(200, {
          data: {
            repository: {
              issues: {
                pageInfo: { hasNextPage: false, endCursor: 'x' },
                nodes: [
                  issueNode(1, true),
                  issueNode(2, false),
                  issueNode(3, false),
                  // The audit's own issue: left out of the figures.
                  {
                    ...issueNode(4, false),
                    labels: { nodes: [{ name: 'repo-sre-audit' }] },
                  },
                ],
              },
            },
          },
        });
      });
      return;
    }
    if (
      req.url?.startsWith(
        '/repos/owner/project/contents/.github/workflows/sre.yml'
      )
    ) {
      const workflow = "on:\n  schedule:\n    - cron: '5 */6 * * *'\n";
      return send(200, { content: Buffer.from(workflow).toString('base64') });
    }
    if (req.url === '/repos/owner/project') {
      return send(200, {
        description: 'A project',
        default_branch: 'main',
        created_at: '2026-10-01T00:00:00Z',
        pushed_at: '2026-11-03T00:00:00Z',
        visibility: 'public',
        private: false,
        stargazers_count: 3,
        forks_count: 1,
        archived: false,
        license: { spdx_id: 'MIT', name: 'MIT License' },
        topics: [],
      });
    }
    if (req.url === '/repos/owner/project/languages') {
      return send(200, { TypeScript: 900, Shell: 100 });
    }
    if (req.url?.startsWith('/repos/owner/project/git/trees/main')) {
      return send(200, {
        truncated: false,
        tree: [
          'README.md',
          'package.json',
          'package-lock.json',
          'src/index.ts',
          'src/index.test.ts',
          'web/package.json',
          'examples/demo/package.json',
          '.github/workflows/sre.yml',
        ].map((path) => ({ path, type: 'blob' })),
      });
    }
    if (req.url?.startsWith('/repos/owner/project/actions/runs')) {
      return send(403, { message: 'Resource not accessible by integration' });
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
          SRE_PUBLISH_TO: 'branch',
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
        await run(path.join(root, 'scripts', 'prepare.sh'));
        await run(path.join(root, 'tracker', 'src', 'main.ts'));
        await run(path.join(root, 'scripts', 'assemble.sh'));
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
        'dashboard/audit/index.html',
        '404.html',
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
      assert.ok(!files.includes('index.html'), 'a branch keeps its own root');
      assert.match(show('404.html'), /<base href="\/project\/dashboard\/"/);
      const status = JSON.parse(show('dashboard/data/status.json'));
      assert.equal(status.schedule.description, 'every 6 hours');
      assert.equal(status.issues.total, 3);
      assert.equal(status.issues.open, 2);
      const check = (id: string) =>
        status.audit.checks.find((c: { id: string }) => c.id === id);
      assert.equal(check('issue-forms').status, 'missing');
      assert.equal(check('tests').status, 'improve');
      assert.equal(check('token-permissions').status, 'missing');
      assert.match(check('token-permissions').evidence, /CI runs/);
      assert.equal(typeof status.audit.score, 'number');
      assert.equal(status.repo.languages[0].name, 'TypeScript');
      assert.equal(status.repo.test_files, 1);
      assert.deepEqual(status.repo.ecosystems, ['npm']);
      assert.equal(status.delivery.source, 'merges');
      assert.equal(config_title(show), 'owner/project');
      assert.equal(status.classes.bug.open, 2);
      assert.equal(status.classes.bug.limit_days, 30);
      assert.equal(status.agents.resolved, 1);
      assert.equal(status.pulls.total, 1);
      assert.equal(status.pulls.by_origin.assisted.opened, 1);
      assert.ok(
        show('dashboard/data/pulls.csv').startsWith('date,agent_opened')
      );
      const config = JSON.parse(show('dashboard/data/config.json'));
      assert.deepEqual(config.limits_days, {
        security: 7,
        bug: 30,
        other: 180,
      });
      assert.equal(config.cost, null);
      assert.equal(config.repository, 'owner/project');
      assert.equal(config.queue, null);
      const csv = show('dashboard/data/data.csv').trim().split('\n');
      assert.match(
        csv[0],
        /^date,open,agent_closed,human_closed,closed_fix_referenced/
      );
      assert.match(csv[0], /security_opened_by_agents/);
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

test(
  'for a Pages deployment the Action assembles the whole site',
  { skip: !hasSite && 'run npm run build first' },
  async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-pages-'));
    const server = await startApi();
    try {
      const port = (server.address() as { port: number }).port;
      const output = path.join(work, 'output');
      const env = {
        ...process.env,
        GITHUB_ACTION_PATH: root,
        GITHUB_REPOSITORY: 'owner/project',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_API_URL: `http://127.0.0.1:${port}`,
        GITHUB_WORKFLOW_REF:
          'owner/project/.github/workflows/sre.yml@refs/heads/main',
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: path.join(work, 'summary'),
        RUNNER_TEMP: work,
        SRE_TOKEN: 'test-token',
        SRE_PUBLISH_TO: 'pages',
        SRE_PATH: 'dashboard',
        SRE_DATA_DIR: path.join(work, 'sre-pages', 'dashboard', 'data'),
      };
      const run = (script: string) =>
        promisify(execFile)(
          script.endsWith('.ts') ? 'node' : 'bash',
          [script],
          { env, cwd: work, encoding: 'utf8' }
        ).then((r) => r.stdout);
      await run(path.join(root, 'scripts', 'prepare.sh'));
      await run(path.join(root, 'tracker', 'src', 'main.ts'));
      await run(path.join(root, 'scripts', 'assemble.sh'));

      const site = path.join(work, 'sre-pages');
      const read = (file: string) =>
        fs.readFileSync(path.join(site, file), 'utf8');
      // No git: the folder is uploaded as the Pages artifact.
      assert.ok(!fs.existsSync(path.join(site, '.git')));
      assert.match(read('index.html'), /url=dashboard\//);
      assert.match(
        read('dashboard/index.html'),
        /<base href="\/project\/dashboard\/"/
      );
      for (const route of ['audit', 'methodology']) {
        assert.match(
          read(`dashboard/${route}/index.html`),
          /<base href="\/project\/dashboard\/"/
        );
      }
      assert.match(read('404.html'), /<base href="\/project\/dashboard\/"/);
      assert.equal(
        JSON.parse(read('dashboard/data/config.json')).repository,
        'owner/project'
      );
      assert.match(
        fs.readFileSync(output, 'utf8'),
        /url=https:\/\/owner\.github\.io\/project\/dashboard\//
      );
    } finally {
      server.close();
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
);
