import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  annunciators,
  doraScale,
  niceCeiling,
  ratioScale,
  type AnnunciatorInputs,
} from './instruments.ts';
import type { ClassFacts } from './report.ts';

const facts = (overLimit: number, limitDays: number): ClassFacts =>
  ({ overLimit, limitDays, open: 10 }) as ClassFacts;

const calm: AnnunciatorInputs = {
  classes: {
    security: facts(0, 7),
    bug: facts(0, 30),
    other: facts(0, 180),
  },
  ci: { failingNow: [], successRate: 0.98 },
  flowRatio: 0.8,
  awaitingReply: 0,
  linkedFixShare: 0.9,
  readinessZone: 'ready',
  doraBands: ['elite', 'high', 'high', 'elite'],
};

test('annunciators stay dark when nothing is abnormal', () => {
  const tiles = annunciators(calm);
  assert.deepEqual(
    tiles.map((t) => t.id),
    [
      'security',
      'past-limit',
      'ci',
      'backlog',
      'replies',
      'closures',
      'readiness',
      'delivery',
    ]
  );
  assert.ok(tiles.every((t) => t.state === 'off'));
});

test('annunciators light amber for caution and red for warning', () => {
  const tiles = annunciators({
    ...calm,
    classes: {
      security: facts(2, 7),
      bug: facts(141, 30),
      other: facts(3, 180),
    },
    ci: { failingNow: ['Conformance'], successRate: 0.86 },
    flowRatio: 12.15,
    awaitingReply: 430,
    linkedFixShare: 0.098,
    readinessZone: 'supervised',
    doraBands: ['high', 'high', 'elite', 'low'],
  });
  const by = Object.fromEntries(tiles.map((t) => [t.id, t]));
  assert.equal(by.security.state, 'warning');
  assert.equal(by.security.detail, '2 past the 7-day limit');
  assert.equal(by['past-limit'].state, 'caution');
  assert.equal(by['past-limit'].detail, '144 bugs and others past limit');
  assert.equal(by.ci.state, 'warning');
  assert.equal(by.ci.detail, 'Failing: Conformance');
  assert.equal(by.backlog.state, 'warning');
  assert.equal(by.backlog.detail, '12.2× opened per closed');
  assert.equal(by.replies.state, 'caution');
  assert.equal(by.replies.detail, '430 open with no reply');
  assert.equal(by.closures.state, 'caution');
  assert.equal(by.closures.detail, '10% reference a fix');
  assert.equal(by.readiness.state, 'off');
  assert.equal(by.delivery.state, 'caution');
  assert.equal(by.delivery.detail, '1 DORA metric low');

  const slight = annunciators({ ...calm, flowRatio: 1.3 });
  assert.equal(slight.find((t) => t.id === 'backlog')!.state, 'caution');
  const none = annunciators({ ...calm, flowRatio: Infinity });
  assert.equal(none.find((t) => t.id === 'backlog')!.state, 'warning');
  assert.equal(
    none.find((t) => t.id === 'backlog')!.detail,
    'Issues arrive, none close'
  );
  const notReady = annunciators({ ...calm, readinessZone: 'not-ready' });
  assert.equal(notReady.find((t) => t.id === 'readiness')!.state, 'caution');
});

test('annunciators without data are dark and say so', () => {
  const tiles = annunciators({
    classes: null,
    ci: null,
    flowRatio: null,
    awaitingReply: null,
    linkedFixShare: null,
    readinessZone: null,
    doraBands: [],
  });
  assert.ok(tiles.every((t) => t.state === 'off'));
  assert.ok(tiles.every((t) => t.detail === 'No data yet'));
});

test('a nice ceiling leaves headroom and round ticks', () => {
  assert.deepEqual(niceCeiling(499.1), { max: 750, step: 250 });
  assert.deepEqual(niceCeiling(91.6), { max: 125, step: 25 });
  assert.deepEqual(niceCeiling(7.5), { max: 10, step: 2.5 });
  assert.deepEqual(niceCeiling(0), { max: 10, step: 2.5 });
});

test('the ratio scale is logarithmic around break-even', () => {
  assert.equal(ratioScale(1).position, 0.5);
  assert.equal(ratioScale(1 / 8).position, 0);
  assert.equal(ratioScale(8).position, 1);
  assert.equal(ratioScale(2).position, 0.5 + 1 / 6);
  assert.equal(ratioScale(100).position, 1);
  assert.equal(ratioScale(100).clipped, true);
  assert.equal(ratioScale(Infinity).position, 1);
  assert.equal(ratioScale(0).position, 0);
  assert.equal(ratioScale(0.8).zone, 'burning');
  assert.equal(ratioScale(1.05).zone, 'steady');
  assert.equal(ratioScale(1.5).zone, 'behind');
  assert.equal(ratioScale(12).zone, 'doom');
});

test('DORA scales place a value among its bands, worse to the left', () => {
  const lead = doraScale('leadTimeHours', 2.1 * 24);
  assert.deepEqual(
    lead.bands.map((b) => b.band),
    ['low', 'medium', 'high', 'elite']
  );
  assert.ok(lead.position! > lead.bands[2].from);
  assert.ok(lead.position! < lead.bands[2].to);
  // Bands tile the scale.
  for (const name of [
    'frequency',
    'leadTimeHours',
    'failureRate',
    'restoreHours',
  ] as const) {
    const s = doraScale(name, null);
    assert.equal(s.position, null);
    assert.equal(s.bands[0].from, 0);
    assert.equal(s.bands[3].to, 1);
    for (let i = 1; i < 4; i++) {
      assert.equal(s.bands[i].from, s.bands[i - 1].to);
    }
  }
  // More deliveries are better, so they sit further right.
  assert.ok(
    doraScale('frequency', 2).position! > doraScale('frequency', 0.3).position!
  );
  assert.equal(doraScale('failureRate', 0.045).position! > 0.75, true);
  assert.equal(doraScale('failureRate', 0.5).position, 0);
});
