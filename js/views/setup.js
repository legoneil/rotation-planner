// "Get set up" on Today: what's left after the first-run setup (account,
// Schoology, grades, notifications, friends), ticked off as each one happens.
// Only the next step shows its buttons, so the card stays short.

import { EXTENSION_URL } from '../grades.js';
import { esc } from '../ui.js';

const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" /></svg>';
const needsAccount = '<p class="muted small">Create an account first (step 1).</p>';

export function setupSteps(ctx) {
  const { state, account, extension, push, friends } = ctx;
  const accounts = Boolean(account?.status) && account.status !== 'disabled';
  const signedIn = account?.status === 'signed-in';
  const sgy = state.schoology ?? {};
  const steps = [];

  if (accounts)
    steps.push({
      key: 'account',
      title: 'Create an account',
      why: 'Your planner on your phone and laptop, and Schoology keeps itself up to date.',
      done: signedIn,
      action: `<button class="btn small" data-action="open-auth" data-mode="signup">Create account</button>
        <button class="link-btn small" data-action="open-auth" data-mode="signin">I already have one</button>`,
    });

  steps.push({
    key: 'schoology',
    title: 'Add your Schoology calendar',
    why: 'Your homework and tests show up here on their own.',
    done: Boolean((sgy.url && sgy.lastSync) || sgy.api?.accessToken),
    action:
      accounts && !signedIn
        ? needsAccount
        : !accounts
          ? '<button class="btn small secondary" data-nav="#/settings">Set up in Settings</button>'
          : `<form class="inline-form" data-form="schoology">
              <input type="url" name="url" inputmode="url" placeholder="webcal://bolles.schoology.com/calendar/feed/ical/..." value="${esc(sgy.url ?? '')}" aria-label="Schoology calendar link" />
              <button class="btn small" type="submit">Connect</button>
            </form>
            ${sgy.lastError ? `<p class="error small">${esc(sgy.lastError)}</p>` : ''}
            <details class="small setup-help"><summary>Where do I find it?</summary>
              <ol>
                <li>On a computer, open <b>Schoology</b> and go to your <b>Calendar</b>.</li>
                <li>Use the calendar’s <b>export</b> (iCal) option and copy the link it shows.</li>
                <li>Paste it above. It usually starts with <code>webcal://bolles.schoology.com</code>.</li>
              </ol>
            </details>`,
  });

  steps.push({
    key: 'grades',
    title: 'Bring in your grades',
    why: 'Install the Rotation Planner Grades extension in Chrome on your laptop. Graded work ticks itself off here.',
    done: Boolean(extension?.installed || state.grades?.courses?.length),
    action: `<a class="btn small" href="${EXTENSION_URL}" target="_blank" rel="noopener">How to install</a>`,
  });

  if (push?.support && push.support !== 'none')
    steps.push({
      key: 'notifications',
      title: 'Turn on reminders',
      why: 'Tests tomorrow, your letter day each morning, and tonight’s study plan.',
      done: Boolean(push.subscribed),
      action: !signedIn
        ? needsAccount
        : push.support === 'ios-browser'
          ? '<p class="muted small">On iPhone, add the planner to your Home Screen first: <b>Share → Add to Home Screen</b>, then open it from there.</p>'
          : `<button class="btn small" data-action="push-enable" ${push.busy ? 'disabled' : ''}>${push.busy ? 'Turning on…' : 'Turn on'}</button>`,
    });

  if (accounts)
    steps.push({
      key: 'friends',
      title: 'Add friends',
      why: 'See when you share classes, lunch and free periods.',
      done: Boolean(friends?.me || friends?.list?.length),
      action: signedIn ? '<button class="btn small" data-nav="#/friends">Invite friends</button>' : needsAccount,
    });

  const skipped = state.settings?.setupSkipped ?? {};
  return steps.map((s) => ({ ...s, skipped: !s.done && Boolean(skipped[s.key]) }));
}

export function setupCard(ctx) {
  if (ctx.state.settings?.setupHidden) return '';
  const steps = setupSteps(ctx);
  const left = steps.filter((s) => !s.done && !s.skipped);
  if (!left.length) return '';
  const done = steps.filter((s) => s.done).length;
  const next = left[0];
  const row = (s) => {
    const state = s.done ? 'done' : s.skipped ? 'skipped' : s === next ? 'is-next' : '';
    const body =
      s.done || s.skipped
        ? ''
        : `<p class="muted small">${s.why}</p>${s === next ? `<div class="setup-action">${s.action}</div>
            <button class="link-btn small setup-skip" data-action="setup-skip" data-key="${s.key}">Skip for now</button>` : ''}`;
    return `<li class="setup-step ${state}">
      <span class="setup-check">${s.done ? CHECK : ''}</span>
      <div class="setup-body">
        <p class="setup-title">${s.title}${s.done ? '<span class="sr-only"> (done)</span>' : s.skipped ? ' <small class="muted">skipped</small>' : ''}</p>
        ${body}
      </div>
    </li>`;
  };
  return `<section class="card setup-card">
    <div class="card-head">
      <h2>Get set up <small class="muted">· ${done} of ${steps.length} done</small></h2>
      <button class="link-btn small" data-action="setup-hide">Hide</button>
    </div>
    <span class="cap-bar" style="--pct:${Math.round((done / steps.length) * 100)}%" aria-hidden="true"></span>
    <ol class="setup-steps">${steps.map(row).join('')}</ol>
  </section>`;
}
