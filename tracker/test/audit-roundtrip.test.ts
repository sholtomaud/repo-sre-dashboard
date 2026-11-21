/**
 * Round-trip tests verifying that applying the audit's own emitted fixes back
 * onto synthetic repository profiles resolves the targeted setup checks and
 * introduces zero new `missing` or `improve` findings (such as unpinned
 * actions, missing workflow permissions, missing cooldowns, or mismatched
 * branch ruleset check names).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  auditScore,
  runAudit,
  type Check,
  type CheckStatus,
} from '../src/audit.ts';
import { costInputs } from '../src/cost.ts';
import { deliveryMetrics } from '../src/delivery.ts';
import { agentRecord, issueSummary } from '../src/issues.ts';
import { pullSummary } from '../src/pulls.ts';
import {
  AGENT_DOCS,
  KEY_FILES,
  ciHealth,
  hasDependencyCooldown,
  hasInstallScriptsDisabled,
  readWorkflow,
  type KeyFile,
  type Profile,
} from '../src/repo.ts';
import { UNSCHEDULED, describeCron, findCron } from '../src/schedule.ts';

const NOW = new Date('2026-11-20T00:00:00Z');

/**
 * Checks whose file fixes configure future runtime automation (publishing a
 * release) rather than flipping a static file-presence check immediately.
 */
const RUNTIME_ONLY_CHECKS = new Set(['releases']);

const STATUS_RANK: Record<CheckStatus, number> = {
  missing: 0,
  improve: 1,
  waiting: 2,
  pass: 3,
};

function emptyProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    description: 'Synthetic project for audit round-trip testing',
    defaultBranch: 'main',
    createdAt: '2026-01-01T00:00:00Z',
    pushedAt: '2026-11-19T00:00:00Z',
    visibility: 'public',
    stars: 10,
    forks: 1,
    archived: false,
    license: 'MIT',
    topics: [],
    languages: {},
    files: 20,
    testFiles: 4,
    truncated: false,
    keyFiles: {
      readme: 'README.md',
      license: 'LICENSE',
      contributing: 'CONTRIBUTING.md',
      security: null,
      codeowners: null,
      dependencyUpdates: null,
      pullTemplate: null,
      socket: null,
      agentInstructions: null,
    },
    dependencyCooldown: null,
    lockfiles: [],
    ecosystems: [],
    issueTemplates: [],
    workflows: [],
    branch: {
      protected: false,
      requiresReview: false,
      requiresChecks: false,
    },
    ciRuns: [],
    releases: [],
    deployments: [],
    labels: [],
    agentDocs: [],
    denied: [],
    ...overrides,
  };
}

function auditProfile(
  profile: Profile,
  options: {
    schedule?: ReturnType<typeof describeCron>;
    costConfigured?: boolean;
  } = {}
): Check[] {
  return runAudit({
    repository: 'owner/project',
    profile,
    summary: issueSummary([]),
    agents: agentRecord([]),
    schedule: options.schedule ?? UNSCHEDULED,
    pulls: pullSummary([], NOW),
    ci: ciHealth([], NOW),
    delivery: deliveryMetrics(profile, [], [], NOW),
    costConfigured: options.costConfigured ?? false,
  });
}

function byId(checks: Check[]): Record<string, Check> {
  return Object.fromEntries(checks.map((c) => [c.id, c]));
}

/**
 * Applies every file fix (`fix.path !== ''`) emitted by non-passing checks
 * back onto a cloned Profile using the tracker's real parsers.
 */
function applyFileFixes(
  profile: Profile,
  checks: Check[]
): { profile: Profile; files: Map<string, string>; checkIds: string[] } {
  const next: Profile = structuredClone(profile);
  const files = new Map<string, string>();
  const checkIds: string[] = [];

  for (const check of checks) {
    if (check.status === 'pass') continue;
    const fileFixes = check.fixes.filter((f) => f.path !== '');
    if (!fileFixes.length) continue;
    checkIds.push(check.id);
    for (const fix of fileFixes) {
      files.set(fix.path, fix.content);
    }
  }

  for (const [filePath, content] of files) {
    next.files += 1;

    if (/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(filePath)) {
      const wf = readWorkflow(filePath, content);
      const idx = next.workflows.findIndex((w) => w.path === filePath);
      if (idx >= 0) next.workflows[idx] = wf;
      else next.workflows.push(wf);
    }

    const templateMatch = /^\.github\/issue_template\/(.+)$/i.exec(filePath);
    if (templateMatch) {
      next.issueTemplates ??= [];
      if (!next.issueTemplates.includes(templateMatch[1])) {
        next.issueTemplates.push(templateMatch[1]);
      }
    }

    for (const [key, pattern] of Object.entries(KEY_FILES) as [
      KeyFile,
      RegExp,
    ][]) {
      if (pattern.test(filePath)) {
        next.keyFiles[key] = filePath;
        if (key === 'dependencyUpdates') {
          next.dependencyCooldown = hasDependencyCooldown(filePath, content);
        }
      }
    }

    if (
      /(^|\/)(\.npmrc|\.yarnrc\.ya?ml|pnpm-workspace\.ya?ml)$/i.test(filePath)
    ) {
      next.installScriptsDisabled = hasInstallScriptsDisabled(
        filePath,
        content
      );
    }

    if (AGENT_DOCS.test(filePath)) {
      const idx = next.agentDocs.findIndex(
        (d) => d.path.toLowerCase() === filePath.toLowerCase()
      );
      if (idx >= 0) next.agentDocs[idx] = { path: filePath, text: content };
      else next.agentDocs.push({ path: filePath, text: content });
    }
  }

  return { profile: next, files, checkIds };
}

/**
 * Verifies workflow-level security and pinning invariants on emitted workflow
 * fixes, returning any violations found.
 */
function workflowFixViolations(files: Map<string, string>): string[] {
  const errors: string[] = [];
  for (const [filePath, content] of files) {
    if (!/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(filePath)) continue;
    const wf = readWorkflow(filePath, content);
    if (wf.unpinned > 0) {
      errors.push(
        `${filePath}: has ${wf.unpinned} unpinned action reference(s)`
      );
    }
    if (!wf.permissions) {
      errors.push(`${filePath}: missing top-level permissions block`);
    }
    if (/^\s*permissions:\s*write-all\b/m.test(content)) {
      errors.push(`${filePath}: requests overly broad permissions: write-all`);
    }
    const usesLines = [...content.matchAll(/^\s*-?\s*uses:\s*(.+)$/gm)].map(
      (m) => m[1].trim()
    );
    for (const ref of usesLines) {
      if (ref.startsWith('./')) continue;
      if (!/@[0-9a-f]{40}\s+#\s+v\d/.test(ref)) {
        errors.push(
          `${filePath}: action not pinned with version comment: ${ref}`
        );
      }
    }
  }
  return errors;
}

/**
 * Extracts and validates the branch ruleset JSON from the `branch-rules` shell
 * snippet, asserting every required check context matches a PR workflow test job.
 */
function validateBranchRulesetFix(
  branchRulesCheck: Check,
  profile: Profile
): { contexts: string[]; violations: string[] } {
  const violations: string[] = [];
  const snippet = branchRulesCheck.fixes[0]?.content ?? '';
  const match = /<<'JSON'\n([\s\S]*?)\nJSON/.exec(snippet);
  if (!match) {
    return {
      contexts: [],
      violations: ['branch-rules fix has no JSON heredoc'],
    };
  }
  const ruleset = JSON.parse(match[1]) as {
    enforcement?: string;
    rules?: {
      type: string;
      parameters?: { required_status_checks?: { context: string }[] };
    }[];
  };
  if (ruleset.enforcement !== 'active') {
    violations.push(
      `expected enforcement "active", got ${ruleset.enforcement}`
    );
  }
  const statusRule = ruleset.rules?.find(
    (r) => r.type === 'required_status_checks'
  );
  if (!statusRule) {
    violations.push('ruleset missing required_status_checks rule');
    return { contexts: [], violations };
  }
  const contexts = (statusRule.parameters?.required_status_checks ?? []).map(
    (c) => c.context
  );
  const actualTestJobs = new Set(
    profile.workflows.filter((w) => w.onPullRequest).flatMap((w) => w.testJobs)
  );
  if (contexts.length === 0) {
    violations.push('ruleset lists no required_status_checks');
  }
  for (const ctx of contexts) {
    if (ctx.includes('REPLACE-WITH')) {
      violations.push(`ruleset still has placeholder context: ${ctx}`);
    } else if (!actualTestJobs.has(ctx)) {
      violations.push(
        `ruleset requires check "${ctx}", which is not reported by PR test jobs [${[...actualTestJobs].join(', ')}]`
      );
    }
  }
  return { contexts, violations };
}

/**
 * Asserts that applying file fixes resolved every targeted non-runtime check
 * and introduced zero regressions anywhere in the audit.
 */
function findRoundTripViolations(
  beforeChecks: Check[],
  afterChecks: Check[],
  appliedCheckIds: string[]
): string[] {
  const violations: string[] = [];
  const before = byId(beforeChecks);
  const after = byId(afterChecks);

  for (const id of appliedCheckIds) {
    if (RUNTIME_ONLY_CHECKS.has(id)) continue;
    if (after[id]?.status !== 'pass') {
      violations.push(
        `check "${id}" remained "${after[id]?.status}" after applying its fix (${after[id]?.evidence})`
      );
    }
  }

  for (const check of afterChecks) {
    const prev = before[check.id];
    if (!prev) continue;
    if (STATUS_RANK[check.status] < STATUS_RANK[prev.status]) {
      violations.push(
        `check "${check.id}" regressed from "${prev.status}" to "${check.status}" (${check.evidence})`
      );
    }
  }

  return violations;
}

const REPRESENTATIVE_PROFILES: { name: string; profile: () => Profile }[] = [
  {
    name: 'npm / TypeScript',
    profile: () =>
      emptyProfile({
        languages: { TypeScript: 900, JavaScript: 100 },
        ecosystems: [{ name: 'npm', directory: '/' }],
        lockfiles: ['package-lock.json'],
      }),
  },
  {
    name: 'Python / pip',
    profile: () =>
      emptyProfile({
        languages: { Python: 1000 },
        ecosystems: [{ name: 'pip', directory: '/' }],
        lockfiles: ['uv.lock'],
      }),
  },
  {
    name: 'Go / gomod',
    profile: () =>
      emptyProfile({
        languages: { Go: 1000 },
        ecosystems: [{ name: 'gomod', directory: '/' }],
        lockfiles: ['go.sum'],
      }),
  },
  {
    name: 'Rust / cargo',
    profile: () =>
      emptyProfile({
        languages: { Rust: 1000 },
        ecosystems: [{ name: 'cargo', directory: '/' }],
        lockfiles: ['Cargo.lock'],
      }),
  },
  {
    name: 'Java / maven',
    profile: () =>
      emptyProfile({
        languages: { Java: 1000 },
        ecosystems: [{ name: 'maven', directory: '/' }],
      }),
  },
  {
    name: 'Kotlin / gradle',
    profile: () =>
      emptyProfile({
        languages: { Kotlin: 1000 },
        ecosystems: [{ name: 'gradle', directory: '/' }],
        lockfiles: ['gradle.lockfile'],
      }),
  },
  {
    name: 'multi-ecosystem monorepo (npm + dashboard + pip)',
    profile: () =>
      emptyProfile({
        languages: { TypeScript: 700, Python: 300 },
        ecosystems: [
          { name: 'npm', directory: '/' },
          { name: 'npm', directory: '/dashboard' },
          { name: 'pip', directory: '/tools' },
        ],
        lockfiles: ['package-lock.json', 'dashboard/package-lock.json'],
      }),
  },
  {
    name: 'private npm repository',
    profile: () =>
      emptyProfile({
        visibility: 'private',
        languages: { TypeScript: 1000 },
        ecosystems: [{ name: 'npm', directory: '/' }],
        lockfiles: ['package-lock.json'],
      }),
  },
  {
    name: 'no-manifest shell repository',
    profile: () =>
      emptyProfile({
        languages: { Shell: 1000 },
        ecosystems: [],
        lockfiles: [],
      }),
  },
];

test('applying emitted audit file fixes resolves setup checks with zero regressions across ecosystems', () => {
  for (const { name, profile: buildProfile } of REPRESENTATIVE_PROFILES) {
    const initial = buildProfile();
    const before = auditProfile(initial);
    const {
      profile: updated,
      files,
      checkIds,
    } = applyFileFixes(initial, before);

    assert.ok(
      checkIds.length >= 8,
      `${name}: expected setup findings with file fixes, got ${checkIds.length}`
    );

    const wfErrors = workflowFixViolations(files);
    assert.deepEqual(wfErrors, [], `${name}: workflow fix violations`);

    // Untrusted issue-triage job in agent-triage.yml must stay least-privilege.
    const triage = files.get('.github/workflows/agent-triage.yml') ?? '';
    const triageJob =
      /  triage:\n([\s\S]*?)\n  respond:/m.exec(triage)?.[1] ?? '';
    assert.ok(
      triageJob.length > 0,
      `${name}: expected triage job in agent-triage.yml`
    );
    assert.doesNotMatch(
      triageJob,
      /contents:\s*write|pull-requests:\s*write/,
      `${name}: untrusted triage job must not request contents: write or pull-requests: write`
    );

    const after = auditProfile(updated);
    const violations = findRoundTripViolations(before, after, checkIds);
    assert.deepEqual(violations, [], `${name}: round-trip violations`);

    const afterMap = byId(after);
    assert.equal(
      afterMap['pinned-actions'].status,
      'pass',
      `${name}: pinned-actions`
    );
    assert.equal(
      afterMap['workflow-permissions'].status,
      'pass',
      `${name}: workflow-permissions`
    );
    assert.equal(
      afterMap['ci-on-pull-requests'].status,
      'pass',
      `${name}: ci-on-pull-requests`
    );
    assert.equal(afterMap['tests'].status, 'pass', `${name}: tests`);
    assert.equal(
      afterMap['dependency-updates'].status,
      'pass',
      `${name}: dependency-updates`
    );
    assert.equal(afterMap['auto-patch'].status, 'pass', `${name}: auto-patch`);
    assert.equal(
      afterMap['agent-instructions'].status,
      'pass',
      `${name}: agent-instructions`
    );
    assert.equal(
      afterMap['agent-instructions-content'].status,
      'pass',
      `${name}: agent-instructions-content`
    );
    assert.equal(afterMap['claude-md'].status, 'pass', `${name}: claude-md`);
    assert.equal(
      afterMap['install-scripts'].status,
      'pass',
      `${name}: install-scripts`
    );
    assert.equal(
      afterMap['secrets-in-package-jobs'].status,
      'pass',
      `${name}: secrets-in-package-jobs`
    );
    assert.equal(
      afterMap['agent-jobs-isolated'].status,
      'pass',
      `${name}: agent-jobs-isolated`
    );
    assert.equal(
      afterMap['checkout-persist-credentials'].status,
      'pass',
      `${name}: checkout-persist-credentials`
    );

    // After applying ci.yml, the emitted branch-rules snippet must name the
    // exact test check(s) that ci.yml reports, with no placeholder left behind.
    const rulesetCheck = validateBranchRulesetFix(
      afterMap['branch-rules'],
      updated
    );
    assert.deepEqual(
      rulesetCheck.violations,
      [],
      `${name}: branch-rules snippet mismatch`
    );
    assert.ok(
      rulesetCheck.contexts.includes('test'),
      `${name}: expected ruleset to require "test" check, got ${rulesetCheck.contexts}`
    );

    const beforeScore = auditScore(before).score ?? 0;
    const afterScore = auditScore(after).score ?? 0;
    assert.ok(
      afterScore > beforeScore,
      `${name}: expected audit score to improve (${beforeScore} -> ${afterScore})`
    );
  }
});

test('non-file audit fixes (branch rules, incident labels, schedule, cost) round-trip cleanly', () => {
  const initial = emptyProfile({
    languages: { TypeScript: 1000 },
    ecosystems: [{ name: 'npm', directory: '/' }],
    lockfiles: ['package-lock.json'],
  });

  // First apply all file fixes (including ci.yml so branch-rules sees the real test job).
  const { profile: withFiles } = applyFileFixes(initial, auditProfile(initial));
  const mid = byId(auditProfile(withFiles));

  // 1. branch-rules: ruleset JSON matches CI test job and resolves branch-rules.
  const ruleset = validateBranchRulesetFix(mid['branch-rules'], withFiles);
  assert.deepEqual(ruleset.violations, []);
  const withBranch = structuredClone(withFiles);
  withBranch.branch = {
    protected: true,
    requiresChecks: ruleset.contexts.length > 0,
    requiresReview: false,
  };

  // 2. incident-labels: `gh label create <name>` commands resolve incident-labels.
  const labelSnippet = mid['incident-labels'].fixes[0]?.content ?? '';
  const createdLabels = [
    ...labelSnippet.matchAll(/^gh label create\s+(\S+)/gm),
  ].map((m) => m[1]);
  assert.ok(createdLabels.length > 0, 'expected gh label create commands');
  withBranch.labels.push(...createdLabels);

  // 3. schedule: YAML snippet parses with findCron + describeCron and resolves schedule.
  const scheduleSnippet = mid['schedule'].fixes[0]?.content ?? '';
  const cron = findCron(scheduleSnippet);
  assert.ok(cron, 'expected valid cron expression in schedule fix');
  const schedule = describeCron(cron);

  // 4. cost: snippet pins the action, uses valid action.yml inputs, and passes costInputs with zero warnings.
  const costSnippet = mid['cost'].fixes[0]?.content ?? '';
  assert.match(
    costSnippet,
    /uses:\s*sholtomaud\/repo-sre-dashboard@[0-9a-f]{40}\s+#\s+v\d/,
    'cost snippet must pin repo-sre-dashboard to a commit SHA with version comment'
  );
  const actionYml = fs.readFileSync(
    path.join(import.meta.dirname, '../../action.yml'),
    'utf8'
  );
  const withPairs = [
    ...costSnippet.matchAll(
      /^\s{4}([a-z][a-z0-9-]+):\s*'?([^'#\n]+?)'?\s*(?:#.*)?$/gm
    ),
  ];
  assert.ok(withPairs.length >= 5, 'expected cost inputs in cost snippet');
  const envMap: Record<string, string> = {};
  for (const [, key, value] of withPairs) {
    assert.match(
      actionYml,
      new RegExp(`^  ${key}:`, 'm'),
      `cost snippet input "${key}" is not declared in action.yml`
    );
    envMap[`SRE_${key.toUpperCase().replace(/-/g, '_')}`] = value.trim();
  }
  const parsedCost = costInputs((k) => envMap[k] ?? '');
  assert.deepEqual(parsedCost.warnings, []);
  assert.ok(parsedCost.cost !== null);

  // Re-run audit with all of those applied: every setup check except runtime `releases` passes.
  const finalChecks = auditProfile(withBranch, {
    schedule,
    costConfigured: parsedCost.cost !== null,
  });
  const finalMap = byId(finalChecks);
  assert.equal(finalMap['branch-rules'].status, 'pass');
  assert.equal(finalMap['incident-labels'].status, 'pass');
  assert.equal(finalMap['schedule'].status, 'pass');
  assert.equal(finalMap['cost'].status, 'pass');

  const remainingSetup = finalChecks
    .filter((c) => c.kind === 'setup' && c.status !== 'pass')
    .map((c) => c.id);
  assert.deepEqual(remainingSetup, ['releases']);
});

test('the round-trip assertions catch broken fixes (unpinned actions, missing permissions, missing cooldown, mismatched ruleset checks)', () => {
  const base = emptyProfile({
    languages: { TypeScript: 1000 },
    ecosystems: [{ name: 'npm', directory: '/' }],
    lockfiles: ['package-lock.json'],
  });
  const before = auditProfile(base);

  // 1. Unpinned action + missing permissions in a workflow fix causes regressions.
  const brokenWorkflows = new Map<string, string>([
    [
      '.github/workflows/ci.yml',
      'name: CI\non: pull_request\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n',
    ],
  ]);
  const wfViolations = workflowFixViolations(brokenWorkflows);
  assert.ok(wfViolations.some((v) => /unpinned/i.test(v)));
  assert.ok(wfViolations.some((v) => /permissions/i.test(v)));

  const withBrokenWorkflow = structuredClone(base);
  withBrokenWorkflow.workflows.push(
    readWorkflow(
      '.github/workflows/ci.yml',
      brokenWorkflows.get('.github/workflows/ci.yml')!
    )
  );
  const regressed = findRoundTripViolations(
    before,
    auditProfile(withBrokenWorkflow),
    ['ci-on-pull-requests']
  );
  assert.ok(regressed.some((v) => v.includes('pinned-actions')));
  assert.ok(regressed.some((v) => v.includes('workflow-permissions')));

  // 2. Dependabot fix without cooldown fails to resolve auto-patch.
  const brokenDependabotCheck: Check = {
    ...byId(before)['auto-patch'],
    fixes: [
      byId(before)['auto-patch'].fixes[0],
      {
        path: '.github/dependabot.yml',
        language: 'yaml',
        content:
          'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n    schedule:\n      interval: weekly\n',
      },
    ],
  };
  const { profile: noCooldownProfile } = applyFileFixes(base, [
    brokenDependabotCheck,
  ]);
  const cooldownViolations = findRoundTripViolations(
    before,
    auditProfile(noCooldownProfile),
    ['auto-patch']
  );
  assert.ok(cooldownViolations.some((v) => v.includes('auto-patch')));

  // 3. Branch ruleset requiring a non-existent CI check name is caught.
  const brokenRulesetCheck: Check = {
    ...byId(before)['branch-rules'],
    fixes: [
      {
        path: '',
        language: 'shell',
        content: `gh api repos/owner/project/rulesets --method POST --input - <<'JSON'
{
  "name": "Protect main",
  "enforcement": "active",
  "rules": [
    { "type": "required_status_checks", "parameters": {
        "required_status_checks": [{ "context": "wrong-check-name" }] } }
  ]
}
JSON`,
      },
    ],
  };
  const rulesetViolations = validateBranchRulesetFix(
    brokenRulesetCheck,
    withBrokenWorkflow
  ).violations;
  assert.ok(rulesetViolations.some((v) => v.includes('wrong-check-name')));
});

test('partial-state fixes (auto-patch cooldown, claude-md import, incomplete AGENTS.md, markdown issue templates) resolve cleanly', () => {
  const autoMergeWf = readWorkflow(
    '.github/workflows/dependabot-auto-merge.yml',
    `name: Dependabot auto-merge
on: pull_request
permissions:
  contents: write
  pull-requests: write
jobs:
  auto-merge:
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98 # v3.1.0
`
  );
  const partial = emptyProfile({
    languages: { TypeScript: 1000 },
    ecosystems: [{ name: 'npm', directory: '/' }],
    lockfiles: ['package-lock.json'],
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
    dependencyCooldown: false,
    issueTemplates: ['bug.md'],
    workflows: [autoMergeWf],
    agentDocs: [
      { path: 'AGENTS.md', text: '# Build\nRun `npm test`.' },
      { path: 'CLAUDE.md', text: '# Claude\nDo not drift.' },
    ],
  });

  const before = auditProfile(partial);
  const beforeMap = byId(before);
  assert.equal(beforeMap['auto-patch'].status, 'improve');
  assert.equal(beforeMap['claude-md'].status, 'improve');
  assert.equal(beforeMap['agent-instructions-content'].status, 'missing');
  assert.equal(beforeMap['issue-forms'].status, 'improve');

  const targeted = [
    beforeMap['auto-patch'],
    beforeMap['claude-md'],
    beforeMap['agent-instructions-content'],
    beforeMap['issue-forms'],
  ];
  const {
    profile: updated,
    files,
    checkIds,
  } = applyFileFixes(partial, targeted);
  assert.deepEqual(workflowFixViolations(files), []);

  const after = auditProfile(updated);
  assert.deepEqual(findRoundTripViolations(before, after, checkIds), []);
  const afterMap = byId(after);
  assert.equal(afterMap['auto-patch'].status, 'pass');
  assert.equal(afterMap['claude-md'].status, 'pass');
  assert.equal(afterMap['agent-instructions-content'].status, 'pass');
  assert.equal(afterMap['issue-forms'].status, 'pass');
});
