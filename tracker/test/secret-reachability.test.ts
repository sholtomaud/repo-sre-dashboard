/**
 * Tests for the secret-reachability audit checks (#31):
 *   1. install-scripts (ignore-scripts=true / enableScripts: false + lockfile hasInstallScript)
 *   2. secrets-in-package-jobs (repository secrets separate from package installs/scripts)
 *   3. agent-jobs-isolated (coding agent jobs with API keys cannot run repo code / shell)
 *   4. checkout-persist-credentials (actions/checkout sets persist-credentials: false when not pushing)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runAudit, type Check } from '../src/audit.ts';
import { deliveryMetrics } from '../src/delivery.ts';
import { agentRecord, issueSummary } from '../src/issues.ts';
import { pullSummary } from '../src/pulls.ts';
import {
  ciHealth,
  hasInstallScriptsDisabled,
  lockfileInstallScripts,
  readWorkflow,
  type Profile,
} from '../src/repo.ts';
import { describeCron } from '../src/schedule.ts';

const NOW = new Date('2026-11-20T00:00:00Z');

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    description: 'Test project',
    defaultBranch: 'main',
    createdAt: '2026-01-01T00:00:00Z',
    pushedAt: '2026-11-19T00:00:00Z',
    visibility: 'public',
    stars: 0,
    forks: 0,
    archived: false,
    license: 'MIT',
    topics: [],
    languages: { TypeScript: 1000 },
    files: 20,
    testFiles: 4,
    truncated: false,
    keyFiles: {
      readme: 'README.md',
      license: 'LICENSE',
      contributing: 'CONTRIBUTING.md',
      security: 'SECURITY.md',
      codeowners: '.github/CODEOWNERS',
      dependencyUpdates: '.github/dependabot.yml',
      pullTemplate: '.github/pull_request_template.md',
      socket: 'socket.yml',
      agentInstructions: 'AGENTS.md',
    },
    dependencyCooldown: true,
    installScriptsDisabled: false,
    installScriptPackages: [],
    lockfiles: ['package-lock.json'],
    ecosystems: [{ name: 'npm', directory: '/' }],
    issueTemplates: ['bug.yml'],
    workflows: [],
    branch: { protected: true, requiresReview: false, requiresChecks: true },
    ciRuns: [],
    releases: [],
    deployments: [],
    labels: ['incident'],
    agentDocs: [],
    denied: [],
    ...overrides,
  };
}

function audit(overrides: Partial<Profile> = {}): Record<string, Check> {
  const profile = baseProfile(overrides);
  const checks = runAudit({
    repository: 'owner/project',
    profile,
    summary: issueSummary([]),
    agents: agentRecord([]),
    schedule: describeCron('5 */6 * * *'),
    pulls: pullSummary([], NOW),
    ci: ciHealth([], NOW),
    delivery: deliveryMetrics(profile, [], [], NOW),
    costConfigured: true,
  });
  return Object.fromEntries(checks.map((c) => [c.id, c]));
}

test('install-scripts detects .npmrc, .yarnrc.yml, pnpm-workspace.yaml and lockfile hasInstallScript', () => {
  assert.equal(
    hasInstallScriptsDisabled('.npmrc', 'ignore-scripts=true\n'),
    true
  );
  assert.equal(
    hasInstallScriptsDisabled(
      '.npmrc',
      '# ignore-scripts=true\nregistry=https://registry.npmjs.org\n'
    ),
    false
  );
  assert.equal(
    hasInstallScriptsDisabled('.npmrc', 'ignore-scripts=false\n'),
    false
  );
  assert.equal(
    hasInstallScriptsDisabled(
      '.yarnrc.yml',
      'nodeLinker: node-modules\nenableScripts: false\n'
    ),
    true
  );
  assert.equal(
    hasInstallScriptsDisabled('.yarnrc.yml', 'enableScripts: true\n'),
    false
  );
  assert.equal(
    hasInstallScriptsDisabled('pnpm-workspace.yaml', 'ignoreScripts: true\n'),
    true
  );

  const lock = JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'app', hasInstallScript: true },
      'node_modules/esbuild': { version: '0.25.0', hasInstallScript: true },
      'node_modules/a/node_modules/fsevents': {
        version: '2.3.3',
        hasInstallScript: true,
      },
      'node_modules/chalk': { version: '5.3.0' },
    },
  });
  assert.deepEqual(lockfileInstallScripts(lock), ['esbuild', 'fsevents']);
  assert.deepEqual(lockfileInstallScripts('not json'), []);
});

test('install-scripts audit check covers non-npm, disabled, and enabled states', () => {
  // Non-npm repo -> pass (not applicable).
  const goCheck = audit({
    ecosystems: [{ name: 'gomod', directory: '/' }],
    lockfiles: ['go.sum'],
    installScriptsDisabled: null,
  })['install-scripts'];
  assert.equal(goCheck.group, 'Supply chain and security');
  assert.equal(goCheck.status, 'pass');

  // npm repo without ignore-scripts -> improve, naming lockfile packages with install scripts.
  const openCheck = audit({
    installScriptsDisabled: false,
    installScriptPackages: ['esbuild', 'fsevents'],
  })['install-scripts'];
  assert.equal(openCheck.status, 'improve');
  assert.match(openCheck.evidence, /esbuild/);
  assert.match(openCheck.evidence, /fsevents/);
  assert.equal(openCheck.fixes[0]?.path, '.npmrc');
  assert.match(openCheck.fixes[0]?.content ?? '', /ignore-scripts=true/);

  // npm repo with ignore-scripts=true -> pass.
  const closedCheck = audit({
    installScriptsDisabled: true,
    installScriptPackages: ['esbuild'],
  })['install-scripts'];
  assert.equal(closedCheck.status, 'pass');
  assert.deepEqual(closedCheck.fixes, []);
});

test('secrets-in-package-jobs flags jobs combining repository secrets with package installs without leaking secret names', () => {
  // Clean split: build runs npm ci with no secrets; publish uses a secret without installing packages.
  const clean = readWorkflow(
    '.github/workflows/release.yml',
    `name: Release
on: push
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - run: npm ci && npm test
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
  publish:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "upload artifact"
        env:
          DEPLOY_KEY: \${{ secrets.SUPER_SECRET_DEPLOY_KEY }}
`
  );
  assert.deepEqual(clean.secretPackageJobs, []);
  assert.equal(
    audit({ workflows: [clean] })['secrets-in-package-jobs'].status,
    'pass'
  );

  // Exposed: single job installs npm/pip packages AND passes a repository secret.
  const exposed = readWorkflow(
    '.github/workflows/deploy.yml',
    `name: Deploy
on: push
permissions:
  contents: read
jobs:
  ship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - run: npm ci && npm run build
        env:
          NPM_TOKEN: \${{ secrets.TOP_SECRET_NPM_TOKEN }}
`
  );
  assert.deepEqual(exposed.secretPackageJobs, ['ship']);
  const check = audit({ workflows: [exposed] })['secrets-in-package-jobs'];
  assert.equal(check.group, 'Supply chain and security');
  assert.equal(check.status, 'improve');
  assert.match(check.evidence, /deploy\.yml/);
  assert.match(check.evidence, /ship/);
  // Must never leak secret names into the public dashboard.
  assert.doesNotMatch(
    `${check.evidence} ${check.why} ${check.recommendation}`,
    /TOP_SECRET_NPM_TOKEN/
  );
});

test('agent-jobs-isolated flags coding-agent jobs with API keys that also get a shell or install packages', () => {
  // No agent jobs with secrets -> pass.
  assert.equal(audit({ workflows: [] })['agent-jobs-isolated'].status, 'pass');

  // Isolated triage job: API key, no package install, no shell tools granted -> pass.
  const isolated = readWorkflow(
    '.github/workflows/agent-triage.yml',
    `name: Agent triage
on:
  issues:
    types: [opened]
permissions: {}
jobs:
  triage:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: anthropics/claude-code-action@469588f42e6b1e94cd14ad09dccfeaec772ce0fd # v1.0.280
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          claude_args: '--disallowedTools Bash'
          prompt: Label the issue.
`
  );
  assert.equal(isolated.hasAgentSecretJob, true);
  assert.deepEqual(isolated.agentCodeJobs, []);
  assert.equal(
    audit({ workflows: [isolated] })['agent-jobs-isolated'].status,
    'pass'
  );

  // Agent job with API key that installs packages -> improve.
  const installsDeps = readWorkflow(
    '.github/workflows/agent-fix.yml',
    `name: Agent fix
on: workflow_dispatch
permissions:
  contents: write
jobs:
  fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - run: npm ci
      - uses: anthropics/claude-code-action@469588f42e6b1e94cd14ad09dccfeaec772ce0fd # v1.0.280
        with:
          anthropic_api_key: \${{ secrets.CLAUDE_PRIVATE_KEY }}
          prompt: Fix the bug.
`
  );
  assert.deepEqual(installsDeps.agentCodeJobs, ['fix']);
  const depCheck = audit({ workflows: [installsDeps] })['agent-jobs-isolated'];
  assert.equal(depCheck.status, 'improve');
  assert.match(depCheck.evidence, /agent-fix\.yml/);
  assert.match(depCheck.evidence, /fix/);
  assert.doesNotMatch(
    `${depCheck.evidence} ${depCheck.why} ${depCheck.recommendation}`,
    /CLAUDE_PRIVATE_KEY/
  );

  // Agent job with API key that explicitly enables Bash/shell -> improve.
  const withShell = readWorkflow(
    '.github/workflows/agent-shell.yml',
    `name: Agent shell
on: workflow_dispatch
permissions:
  contents: write
jobs:
  solve:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: anthropics/claude-code-action@469588f42e6b1e94cd14ad09dccfeaec772ce0fd # v1.0.280
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          claude_args: '--allowedTools "Bash(npm test)"'
          prompt: Solve it.
`
  );
  assert.deepEqual(withShell.agentCodeJobs, ['solve']);
  const shellCheck = audit({ workflows: [withShell] })['agent-jobs-isolated'];
  assert.equal(shellCheck.status, 'improve');
  assert.match(shellCheck.evidence, /agent-shell\.yml/);
  assert.match(shellCheck.evidence, /solve/);
});

test('checkout-persist-credentials flags non-pushing checkouts without persist-credentials: false and allows pushing jobs', () => {
  // Non-pushing job without persist-credentials: false -> improve (low impact).
  const leaky = readWorkflow(
    '.github/workflows/ci.yml',
    `name: CI
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - run: npm test
`
  );
  assert.deepEqual(leaky.persistedCheckoutJobs, ['test']);
  const leakyCheck = audit({ workflows: [leaky] })[
    'checkout-persist-credentials'
  ];
  assert.equal(leakyCheck.group, 'Supply chain and security');
  assert.equal(leakyCheck.impact, 'low');
  assert.equal(leakyCheck.status, 'improve');
  assert.match(leakyCheck.evidence, /ci\.yml/);
  assert.match(leakyCheck.evidence, /test/);

  // Non-pushing job WITH persist-credentials: false -> pass.
  const safe = readWorkflow(
    '.github/workflows/ci.yml',
    `name: CI
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - run: npm test
`
  );
  assert.deepEqual(safe.persistedCheckoutJobs, []);
  assert.equal(
    audit({ workflows: [safe] })['checkout-persist-credentials'].status,
    'pass'
  );

  // Pushing job (contents: write + git push) without persist-credentials: false -> pass.
  const pushing = readWorkflow(
    '.github/workflows/publish.yml',
    `name: Publish
on: push
permissions:
  contents: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - run: git commit --allow-empty -m "bump" && git push
`
  );
  assert.deepEqual(pushing.persistedCheckoutJobs, []);
  assert.equal(
    audit({ workflows: [pushing] })['checkout-persist-credentials'].status,
    'pass'
  );

  // This repository's own .npmrc disables install scripts.
  const ownNpmrc = fs.readFileSync(
    path.join(import.meta.dirname, '../../.npmrc'),
    'utf8'
  );
  assert.equal(hasInstallScriptsDisabled('.npmrc', ownNpmrc), true);
});

test('this repository passes all four secret-reachability checks on its own workflows and .npmrc', () => {
  const wfDir = path.join(import.meta.dirname, '../../.github/workflows');
  const workflows = fs
    .readdirSync(wfDir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .map((f) =>
      readWorkflow(
        `.github/workflows/${f}`,
        fs.readFileSync(path.join(wfDir, f), 'utf8')
      )
    );
  const npmrc = fs.readFileSync(
    path.join(import.meta.dirname, '../../.npmrc'),
    'utf8'
  );
  const checks = audit({
    workflows,
    installScriptsDisabled: hasInstallScriptsDisabled('.npmrc', npmrc),
  });
  assert.equal(
    checks['install-scripts'].status,
    'pass',
    checks['install-scripts'].evidence
  );
  assert.equal(
    checks['secrets-in-package-jobs'].status,
    'pass',
    checks['secrets-in-package-jobs'].evidence
  );
  assert.equal(
    checks['agent-jobs-isolated'].status,
    'pass',
    checks['agent-jobs-isolated'].evidence
  );
  assert.equal(
    checks['checkout-persist-credentials'].status,
    'pass',
    checks['checkout-persist-credentials'].evidence
  );
});
