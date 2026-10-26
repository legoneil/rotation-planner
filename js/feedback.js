// "Send feedback": an email to the developer with the student's message and
// a few details about the app (never their email, assignments or grades).
// School laptops often have no email app set up, so Gmail and Outlook on the
// web are offered too, plus copying it all.

export const APP_VERSION = 16; // keep in step with CACHE in sw.js (a test checks)
export const FEEDBACK_EMAIL = 'bollesplanner@gmail.com';

export const KINDS = { bug: 'Something’s wrong', idea: 'An idea', other: 'Something else' };

// "Windows · Chrome 141" from a user agent string.
export function deviceSummary(ua = '') {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iPhone/iPad'
    : /Android/.test(ua)
      ? 'Android'
      : /CrOS/.test(ua)
        ? 'Chromebook'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown device';
  const browser =
    [
      ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
      ['Opera', /OPR\/(\d+)/],
      ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
      ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
      ['Safari', /Version\/(\d+).*Safari/],
    ]
      .map(([name, re]) => [name, re.exec(ua)?.[1]])
      .find(([, v]) => v) ?? null;
  return browser ? `${os} · ${browser[0]} ${browser[1]}` : os;
}

// The lines appended to every message, so a bug report says where it happened.
export function feedbackDetails({ page, ua, standalone, extension, account, schoology, push, campus, grade }) {
  return [
    `Rotation Planner ${APP_VERSION}`,
    `Page: ${page || '#/today'}`,
    `Device: ${deviceSummary(ua)}${standalone ? ' (installed app)' : ''}`,
    `Grades extension: ${extension?.installed ? `version ${extension.version ?? '?'}` : 'not detected'}`,
    `Account: ${account === 'signed-in' ? 'signed in' : 'not signed in'}`,
    `Schoology calendar: ${schoology ? 'connected' : 'not connected'}`,
    `Notifications: ${push ? 'on' : 'off'}`,
    campus ? `School: ${campus}${grade ? `, grade ${grade}` : ''}` : null,
  ].filter(Boolean);
}

export function feedbackEmail({ kind = 'other', message = '', details = [] }) {
  const subject = `Rotation Planner: ${KINDS[kind] ?? KINDS.other}`;
  const body = `${message.trim() || '(write here)'}\n\n---\n${details.join('\n')}\n`;
  const q = (params) =>
    Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  return {
    subject,
    body,
    mailto: `mailto:${FEEDBACK_EMAIL}?${q({ subject, body })}`,
    gmail: `https://mail.google.com/mail/?${q({ view: 'cm', fs: 1, to: FEEDBACK_EMAIL, su: subject, body })}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?${q({ to: FEEDBACK_EMAIL, subject, body })}`,
    text: `To: ${FEEDBACK_EMAIL}\nSubject: ${subject}\n\n${body}`,
  };
}
