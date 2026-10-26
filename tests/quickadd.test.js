import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseQuickAdd } from '../js/quickadd.js';

const classes = [
  { id: 'bio', period: 1, name: 'AP Biology', teacher: 'Ms. Hicks' },
  { id: 'eng', period: 2, name: 'English 10', teacher: 'Mr. Dale' },
  { id: 'calc', period: 3, name: 'Precalculus Honors', teacher: 'Mr. Elliott' },
  { id: 'span', period: 5, name: 'Spanish III', teacher: 'Sra. Garcia' },
  { id: 'hist', period: 6, name: 'US History', teacher: 'Mr. Hart' },
  { id: 'chem', period: 7, name: 'Chemistry', teacher: 'Dr. Li' },
];
// Tuesday Oct 27 2026 is a G day; then A, B, C, (weekend), D, E, F, G on Nov 5.
const ctx = { today: '2026-10-27', profile: { campus: 'us', grade: 10, classes, closures: {} } };
const q = (text) => parseQuickAdd(text, ctx);
const pick = (r) => [r.title, r.type, r.classId, r.dueDate];

test('the examples', () => {
  assert.deepEqual(pick(q('bio test friday')), ['Bio test', 'test', 'bio', '2026-10-30']);
  assert.deepEqual(pick(q('read ch 7 for english tomorrow')), ['Read ch 7', 'reading', 'eng', '2026-10-28']);
  assert.deepEqual(pick(q('math hw tonight')), ['Math hw', 'homework', 'calc', '2026-10-28']);
  assert.deepEqual(pick(q('Spanish vocab quiz on G day')), ['Spanish vocab quiz', 'quiz', 'span', '2026-11-05'], 'today is G: the next one');
  assert.equal(q('quiz on b day').dueDate, '2026-10-29');
});

test('dates', () => {
  const due = (t) => q(t).dueDate;
  assert.equal(due('essay due 11/4'), '2026-11-04');
  assert.equal(due('essay due nov 4th'), '2026-11-04');
  assert.equal(due('essay due 4 nov'), '2026-11-04');
  assert.equal(due('project in 2 weeks'), '2026-11-10');
  assert.equal(due('project in a week'), '2026-11-03');
  assert.equal(due('lab tuesday'), '2026-11-03', 'never today: next Tuesday');
  assert.equal(due('lab this thursday'), '2026-10-29');
  assert.equal(due('lab next thursday'), '2026-11-05');
  assert.equal(due('quiz today'), '2026-10-27');
  assert.equal(due('reading due 1/12'), '2027-01-12', 'past dates are next year');
  assert.equal(q('lab this thursday').title, 'Lab');
});

test('no date: due at the class’s next meeting', () => {
  const r = q('chem lab report');
  assert.equal(r.classId, 'chem');
  assert.equal(r.type, 'lab');
  assert.equal(r.dueAtClass, true);
  assert.ok(r.dueDate > ctx.today);
  const next = q('bio worksheet next class');
  const after = q('bio worksheet class after');
  assert.equal(next.dueDate, '2026-10-28');
  assert.ok(after.dueDate > next.dueDate);
  assert.equal(next.title, 'Bio worksheet');
  assert.equal(q('worksheet').dueDate, null, 'no class, no date');
  assert.equal(q('bio test friday').dueAtClass, false);
});

test('classes by nickname, period or teacher; ties pick none', () => {
  assert.equal(q('precalc problem set').classId, 'calc');
  assert.equal(q('p6 notes').classId, 'hist');
  assert.equal(q('p6 notes').title, 'Notes');
  assert.equal(q('hicks reading').classId, 'bio');
  assert.equal(q('history essay').classId, 'hist');
  assert.equal(q('science project').classId, null, 'biology and chemistry: can’t tell');
  assert.equal(q('science project for chem').classId, 'chem');
});

test('times, and words that only look like dates', () => {
  assert.equal(q('bio reading 45 min').minutes, 45);
  assert.equal(q('bio reading 1.5h').minutes, 90);
  assert.equal(q('bio reading 1.5h').title, 'Bio reading');
  const sat = q('SAT prep packet tomorrow');
  assert.equal(sat.dueDate, '2026-10-28');
  assert.equal(sat.title, 'SAT prep packet');
  assert.equal(q('practice on sat').dueDate, '2026-10-31');
  assert.equal(q('Tom Sawyer reading for english').title, 'Tom Sawyer reading');
});
