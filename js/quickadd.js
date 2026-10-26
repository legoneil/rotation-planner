// Quick add: "bio test friday" or "read ch 7 for english tomorrow" into an
// assignment. Finds the class (by name, nickname, period or teacher), the
// type, the due date (weekday, date, "tomorrow", "in 3 days", "on G day",
// "next class") and how long it takes. With a class but no date, it's due at
// that class's next meeting.

import { matchType } from './ical.js';
import { addDays, startOfWeek, weekday } from './dates.js';
import { getDay, nextMeeting } from './schedule.js';

// Nicknames students type, and the class-name words they stand for.
const NICKNAMES = {
  bio: ['biology'],
  chem: ['chemistry'],
  phys: ['physics'],
  calc: ['calculus'],
  precalc: ['precalculus'],
  alg: ['algebra'],
  geo: ['geometry'],
  geom: ['geometry'],
  trig: ['trigonometry', 'precalculus'],
  stats: ['statistics'],
  stat: ['statistics'],
  math: ['math', 'mathematics', 'algebra', 'geometry', 'precalculus', 'calculus', 'statistics'],
  science: ['science', 'biology', 'chemistry', 'physics'],
  eng: ['english'],
  lit: ['literature', 'english'],
  hist: ['history'],
  gov: ['government'],
  econ: ['economics'],
  psych: ['psychology'],
  span: ['spanish'],
  spanish: ['spanish'],
  french: ['french'],
  latin: ['latin'],
  cs: ['computer'],
  compsci: ['computer'],
  env: ['environmental'],
  apes: ['environmental'],
};
// Words in class names that don't say which class it is.
const FILLER = new Set(['ap', 'honors', 'h', 'i', 'ii', 'iii', 'iv', 'v', 'the', 'and', 'of', 'to', 'intro', 'introduction', 'advanced', 'adv', 'us', 'ms']);

const WEEKDAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const monthOf = (w) => MONTHS[w] ?? MONTHS[w.slice(0, 3)] ?? null;
const pad = (n) => String(n).padStart(2, '0');
// Lowercase, without punctuation (but keeping "10/30" and "1.5h").
const word = (t) => t.toLowerCase().replace(/[^a-z0-9/.]/g, '').replace(/^\.+|\.+$/g, '');

const classWords = (c) =>
  (c.name ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));

function tokenMatchesClass(t, c) {
  if (!t) return false;
  const p = /^(?:p|per|period)(\d)$/.exec(t);
  if (p) return Number(c.period) === Number(p[1]);
  const teacher = (c.teacher ?? '').toLowerCase().replace(/^(mr|mrs|ms|dr|mx|coach|sra|sr|mme)\.?\s*/, '').split(/\s+/).pop();
  if (teacher && teacher.length >= 3 && t === teacher.replace(/[^a-z]/g, '')) return true;
  const words = classWords(c);
  const wanted = [t, ...(NICKNAMES[t] ?? [])];
  return wanted.some((w) => words.some((cw) => cw === w || (w.length >= 4 && cw.startsWith(w))));
}

// A date written as text, relative to `today`. Returns [date, tokensUsed] or null.
function readDate(tokens, i, ctx) {
  const today = ctx.today;
  const t = tokens[i];
  const next = tokens[i + 1] ?? '';
  if (t === 'today') return [today, 1];
  // "math hw tonight": done tonight, due tomorrow.
  if (['tonight', 'tomorrow', 'tmrw', 'tmr', 'tmw'].includes(t)) return [addDays(today, 1), 1];
  if (t === 'in' && (/^\d+$/.test(next) || next === 'a') && /^(day|days|week|weeks)$/.test(tokens[i + 2] ?? '')) {
    const n = next === 'a' ? 1 : Number(next);
    return [addDays(today, tokens[i + 2].startsWith('week') ? n * 7 : n), 3];
  }
  if (t === 'next' && next in WEEKDAYS) {
    // "next friday": the Friday of next week.
    return [addDays(startOfWeek(addDays(startOfWeek(today), 7)), (WEEKDAYS[next] + 6) % 7), 2];
  }
  if (t === 'this' && next in WEEKDAYS) {
    const found = readDate(tokens, i + 1, ctx);
    return found && [found[0], 2];
  }
  // "SAT prep" isn't Saturday: short names that are also words need "on sat" or to come last.
  if (t in WEEKDAYS && (!['sat', 'sun'].includes(t) || ['on', 'by', 'due', 'this'].includes(tokens[i - 1]) || i === tokens.length - 1)) {
    // The coming one, never today.
    const diff = (WEEKDAYS[t] - weekday(today) + 7) % 7 || 7;
    return [addDays(today, diff), 1];
  }
  // "10/30" or "10/30/26"
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (slash) return fullDate(Number(slash[1]), Number(slash[2]), slash[3], today, 1);
  // "oct 30", "october 30th", "30 oct"
  const day = (s) => /^(\d{1,2})(st|nd|rd|th)?$/.exec(s)?.[1];
  if (monthOf(t) && day(next)) return fullDate(monthOf(t), Number(day(next)), null, today, 2);
  if (day(t) && monthOf(next)) return fullDate(monthOf(next), Number(day(t)), null, today, 2);
  // "g day", "on G day"
  if (/^[a-g]$/.test(t) && next === 'day') {
    const letter = t.toUpperCase();
    for (let d = 1; d <= 30; d++) {
      const date = addDays(today, d);
      if (getDay(date, ctx.profile).letter === letter) return [date, 2];
    }
  }
  return null;
}

function fullDate(month, day, year, today, used) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : Number(today.slice(0, 4));
  let date = `${y}-${pad(month)}-${pad(day)}`;
  // No year and already past (by more than a week): next year.
  if (!year && date < addDays(today, -7)) date = `${(y += 1)}-${pad(month)}-${pad(day)}`;
  return [date, used];
}

const LINKS = new Set(['due', 'on', 'by', 'for', 'in', 'at']);

export function parseQuickAdd(text, ctx) {
  const raw = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const tokens = raw.map(word);
  const used = new Set(); // token positions that aren't part of the title
  const classes = (ctx.profile?.classes ?? []).filter((c) => c.name);

  // Due date, and "next class" / "class after".
  let dueDate = null;
  let dateWritten = false;
  let classMeeting = 0; // 1: next class, 2: the one after
  for (let i = 0; i < tokens.length && !dueDate && !classMeeting; i++) {
    if ((tokens[i] === 'next' && /^(class|time|block)$/.test(tokens[i + 1] ?? '')) || (tokens[i] === 'class' && tokens[i + 1] === 'after')) {
      classMeeting = tokens[i] === 'next' ? 1 : 2;
      used.add(i).add(i + 1);
      continue;
    }
    const found = readDate(tokens, i, ctx);
    if (found) {
      [dueDate] = found;
      dateWritten = true;
      for (let k = 0; k < found[1]; k++) used.add(i + k);
    }
  }

  // How long: "30 min", "1h", "1.5 hours".
  let minutes = null;
  tokens.forEach((t, i) => {
    const glued = /^(\d+(?:\.\d+)?)(m|min|mins|minutes|h|hr|hrs|hour|hours)$/.exec(t);
    const split = /^\d+(\.\d+)?$/.test(t) && /^(m|min|mins|minutes|h|hr|hrs|hour|hours)$/.test(tokens[i + 1] ?? '');
    if (!glued && !split) return;
    const [n, unit] = glued ? [glued[1], glued[2]] : [t, tokens[i + 1]];
    minutes = Math.round(Number(n) * (unit.startsWith('h') ? 60 : 1));
    used.add(i);
    if (split) used.add(i + 1);
  });

  // Class: the one most of the words point to (none if it's a tie).
  const hits = classes.map((c) => ({ c, at: tokens.map((t, i) => (!used.has(i) && tokenMatchesClass(t, c) ? i : -1)).filter((i) => i >= 0) }));
  const best = Math.max(0, ...hits.map((h) => h.at.length));
  const top = hits.filter((h) => h.at.length === best);
  const match = best && top.length === 1 ? top[0] : null;
  const classId = match?.c.id ?? null;
  // "for english", "in bio", "p3": not part of the title.
  for (const i of match?.at ?? []) {
    if (LINKS.has(tokens[i - 1]) || /^(?:p|per|period)\d$/.test(tokens[i])) used.add(i).add(i - 1);
  }

  if (!dueDate && classId) {
    const first = nextMeeting(ctx.profile, classId, ctx.today, { inclusive: false });
    const second = classMeeting === 2 && first ? nextMeeting(ctx.profile, classId, first.date, { inclusive: false }) : null;
    dueDate = (classMeeting === 2 ? second : first)?.date ?? null;
  }

  // The title: what's left, without words that only led into a date.
  const keep = raw.filter((_, i) => !used.has(i));
  while (keep.length && LINKS.has(word(keep.at(-1)))) keep.pop();
  for (let i = keep.length - 1; i > 0; i--) if (LINKS.has(word(keep[i])) && LINKS.has(word(keep[i - 1]))) keep.splice(i, 1);
  const title = keep.join(' ').replace(/^\w/, (c) => c.toUpperCase());

  return {
    title,
    type: matchType(text) ?? 'homework',
    classId,
    dueDate,
    // Due at a class meeting because no date was written.
    dueAtClass: Boolean(dueDate && !dateWritten),
    minutes,
  };
}
