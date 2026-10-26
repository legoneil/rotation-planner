import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { APP_VERSION, deviceSummary, feedbackDetails, feedbackEmail } from '../js/feedback.js';
import { TEACHER_NAMES } from '../js/forms.js';
import { setupCard, setupSteps } from '../js/views/setup.js';

test('the app version matches the offline cache', () => {
  const cache = /const CACHE = 'bolles-planner-v(\d+)'/.exec(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))[1];
  assert.equal(Number(cache), APP_VERSION, 'bump APP_VERSION in js/feedback.js together with CACHE in sw.js');
});

test('device summaries', () => {
  const cases = {
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36': 'Windows · Chrome 141',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0': 'Windows · Edge 141',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15': 'Mac · Safari 18',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1': 'iPhone/iPad · Chrome 141',
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36': 'Chromebook · Chrome 140',
    '': 'Unknown device',
  };
  for (const [ua, want] of Object.entries(cases)) assert.equal(deviceSummary(ua), want, ua);
});

test('feedback email: message plus app details, nothing personal', () => {
  const details = feedbackDetails({ page: '#/plan', ua: '', standalone: true, extension: { installed: true, version: '1.0.0' }, account: 'signed-in', schoology: true, push: false, campus: 'Upper School', grade: 10 });
  assert.deepEqual(details, [
    `Rotation Planner ${APP_VERSION}`,
    'Page: #/plan',
    'Device: Unknown device (installed app)',
    'Grades extension: version 1.0.0',
    'Account: signed in',
    'Schoology calendar: connected',
    'Notifications: off',
    'School: Upper School, grade 10',
  ]);
  const mail = feedbackEmail({ kind: 'bug', message: 'Plan shows a test twice & more', details });
  assert.equal(mail.subject, 'Rotation Planner: Something’s wrong');
  assert.ok(mail.mailto.startsWith('mailto:bollesplanner@gmail.com?subject=Rotation%20Planner'));
  assert.ok(mail.mailto.includes(encodeURIComponent('Plan shows a test twice & more')));
  assert.ok(mail.gmail.startsWith('https://mail.google.com/mail/?view=cm'));
  assert.ok(mail.outlook.startsWith('https://outlook.office.com/mail/deeplink/compose?to=bollesplanner%40gmail.com'));
  assert.ok(mail.text.includes('Page: #/plan'));
});

test('teacher suggestions are plain last names', () => {
  assert.ok(TEACHER_NAMES.includes('Hicks') && TEACHER_NAMES.includes('Bruns') && TEACHER_NAMES.includes('Curran'));
  assert.ok(!TEACHER_NAMES.some((t) => /[,-]\s|\s-/.test(t)), 'no subjects or initials');
  assert.equal(new Set(TEACHER_NAMES).size, TEACHER_NAMES.length);
});

test('setup checklist: next step first, ticks off as things happen, can be skipped or hidden', () => {
  const base = { state: { schoology: {}, settings: {}, grades: null }, account: { status: 'signed-out' }, extension: { installed: false }, push: { support: 'ok', subscribed: false }, friends: { me: null, list: [] } };
  const keys = (ctx) => setupSteps(ctx).map((s) => `${s.key}${s.done ? '✓' : ''}${s.skipped ? '~' : ''}`);
  assert.deepEqual(keys(base), ['account', 'schoology', 'grades', 'notifications', 'friends']);
  let html = setupCard(base);
  assert.match(html, /0 of 5 done/);
  assert.match(html, /data-mode="signup"/);
  assert.equal((html.match(/setup-action/g) ?? []).length, 1, 'only the next step shows its buttons');

  const going = {
    ...base,
    state: { ...base.state, schoology: { url: 'webcal://x', lastSync: 1 } },
    account: { status: 'signed-in' },
    extension: { installed: true },
  };
  assert.deepEqual(keys(going), ['account✓', 'schoology✓', 'grades✓', 'notifications', 'friends']);
  html = setupCard(going);
  assert.match(html, /3 of 5 done/);
  assert.match(html, /data-action="push-enable"/);

  const skipped = { ...going, state: { ...going.state, settings: { setupSkipped: { notifications: true } } } };
  assert.match(setupCard(skipped), /data-nav="#\/friends"/);
  assert.equal(setupCard({ ...going, friends: { me: { code: 'x' }, list: [] }, push: { support: 'ok', subscribed: true } }), '', 'all done: no card');
  assert.equal(setupCard({ ...base, state: { ...base.state, settings: { setupHidden: true } } }), '');
  // No push support and no accounts: those steps aren't offered.
  assert.deepEqual(keys({ ...base, account: { status: 'disabled' }, push: { support: 'none' } }), ['schoology', 'grades']);
});
