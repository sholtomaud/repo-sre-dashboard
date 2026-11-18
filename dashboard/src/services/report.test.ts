import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findings,
  formatLimit,
  parseAudit,
  parseCi,
  parseClasses,
  parseDelivery,
  parseRepo,
  priorities,
  readiness,
} from './report.ts';

const check = (id: string, status: string, impact: string) => ({
  id,
  group: 'Code and CI',
  title: `Check ${id}`,
  kind: 'setup',
  impact,
  status,
  evidence: `found ${id}`,
  why: 'because',
  recommendation: status === 'pass' ? '' : `fix ${id}`,
  fixes: [{ path: 'a.yml', language: 'yaml', content: 'x: 1' }, { nope: 1 }],
  docs: 'https://docs.github.com/x',
});

test('the audit is read safely and prioritised by impact', () => {
  const audit = parseAudit({
    audit: {
      score: 62,
      checks: [
        check('a', 'improve', 'low'),
        check('b', 'missing', 'high'),
        check('c', 'pass', 'high'),
        check('d', 'improve', 'high'),
        { ...check('e', 'weird', 'odd'), docs: 'javascript:alert(1)' },
        { nope: true },
      ],
    },
  })!;
  assert.equal(audit.score, 62);
  assert.equal(audit.checks.length, 5);
  assert.equal(audit.checks[0].fixes.length, 1);
  assert.equal(audit.checks[4].status, 'waiting');
  assert.equal(audit.checks[4].impact, 'low');
  assert.equal(audit.checks[4].docs, '');
  assert.equal(audit.passed, 1);
  assert.deepEqual(
    priorities(audit.checks).map((c) => c.id),
    ['b', 'd', 'a']
  );
  assert.equal(parseAudit({}), null);
});

test('readiness: distance from ideal, the projected score and the zone', () => {
  const audit = parseAudit({
    audit: {
      score: 40,
      checks: [
        { ...check('a', 'missing', 'high'), group: 'Supply chain' },
        // Only a command to run: not part of the files to add.
        {
          ...check('b', 'improve', 'medium'),
          fixes: [{ path: '', language: 'shell', content: 'gh label …' }],
        },
        check('c', 'pass', 'high'),
        // Habits need practice, not files.
        { ...check('d', 'missing', 'low'), kind: 'habit' },
        { ...check('e', 'waiting', 'high'), group: 'AI agents' },
      ],
    },
  })!;
  const r = readiness(audit)!;
  assert.equal(r.score, 40);
  assert.equal(r.distance, 60);
  // a passes: (3 + 3 + 0.5 × 2) of 9 weighted points.
  assert.equal(r.projected, 78);
  assert.deepEqual(r.fileFixes, ['a']);
  assert.equal(r.zone.id, 'not-ready');
  assert.deepEqual(
    r.groups.map((g) => [g.group, g.score, g.passed, g.judged]),
    [
      ['Supply chain', 0, 0, 1],
      ['Code and CI', 67, 1, 3],
      ['AI agents', null, 0, 0],
    ]
  );

  // Without a score from the tracker, it is worked out from the checks.
  const fresh = readiness({ ...audit, score: null })!;
  assert.equal(fresh.score, 44);
  assert.equal(readiness({ ...audit, checks: [], score: null }), null);
  assert.equal(readiness(null), null);
});

test('readiness zones name the agent autonomy a repository can carry', () => {
  const zone = (score: number) =>
    readiness({ score, passed: 0, judged: 1, waiting: 0, checks: [] })!.zone.id;
  assert.equal(zone(49), 'not-ready');
  assert.equal(zone(50), 'supervised');
  assert.equal(zone(79), 'supervised');
  assert.equal(zone(80), 'ready');
  assert.equal(zone(100), 'ready');
});

test('profile, CI, delivery and classes are read from status.json', () => {
  const repo = parseRepo({
    repo: {
      default_branch: 'trunk',
      languages: [{ name: 'Go', share: 0.9 }, { share: 1 }],
      files: 40,
      test_files: 8,
      workflows: [{ name: 'CI', on_pull_request: true, runs_tests: true }],
      branch: { protected: true },
    },
  })!;
  assert.equal(repo.defaultBranch, 'trunk');
  assert.equal(repo.languages.length, 1);
  assert.equal(repo.protected, true);
  assert.equal(repo.workflows[0].runsTests, true);

  const ci = parseCi({
    ci: { runs: 10, success_rate: 0.9, failing_now: ['CI'] },
  })!;
  assert.equal(ci.successRate, 0.9);
  assert.deepEqual(ci.failingNow, ['CI']);

  const delivery = parseDelivery({
    delivery: {
      source: 'releases',
      deployment_frequency: {
        value: 0.2,
        band: 'high',
        count: 6,
        basis: 'releases',
      },
      lead_time_hours: { value: null, band: 'bogus' },
    },
  })!;
  assert.equal(delivery.source, 'releases');
  assert.equal(delivery.frequency.band, 'high');
  assert.equal(delivery.leadTimeHours.band, null);
  assert.equal(parseDelivery({ delivery: { source: 'x' } })!.source, 'merges');

  const classes = parseClasses({
    classes: { security: { open: 2, over_limit: 1, limit_days: 7 } },
  })!;
  assert.equal(classes.security.overLimit, 1);
  assert.equal(classes.bug.open, 0);
  assert.equal(parseClasses({}), null);
});

test('findings put limits, broken CI and a growing backlog first', () => {
  const classes = parseClasses({
    classes: {
      security: { open: 2, over_limit: 2, limit_days: 7 },
      bug: { open: 5, over_limit: 1, limit_days: 30 },
      other: { open: 9, over_limit: 0, limit_days: 180 },
    },
  });
  const list = findings({
    classes,
    ci: parseCi({ ci: { runs: 4, failing_now: ['Build'] } }),
    flowRatio: 1.6,
    audit: parseAudit({ audit: { checks: [check('b', 'missing', 'high')] } }),
  });
  assert.deepEqual(
    list.map((f) => f.tone),
    ['bad', 'bad', 'bad', 'warn', 'bad']
  );
  assert.match(
    list[0].text,
    /2 open security issues are older than the 7-day limit/
  );
  assert.match(list[1].text, /1 open bug is older/);
  assert.match(list[2].text, /Build/);
  assert.match(list[3].text, /1\.6× faster/);
  assert.equal(list[4].href, '/audit#b');
  assert.deepEqual(
    findings({ classes: null, ci: null, flowRatio: 0.8, audit: null }),
    []
  );
  assert.equal(formatLimit(0.5), '12-hour');
});
