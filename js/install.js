// "Add to Home Screen" on phones. Installed, the planner opens like an app,
// works offline, and on iPhone it's the only way to get notifications.
// Android (Chrome) lets the page show the install prompt; iPhone needs the
// Share menu, so it gets steps instead. "Not now" lasts two weeks, on this
// device only.

export const install = { platform: null, standalone: false, canPrompt: false, installed: false, dismissedUntil: 0 };

const KEY = 'rotation-planner:install-dismissed';
const SNOOZE_DAYS = 14;
let deferred = null;

export const isIOS = (ua, platform = '', touchPoints = 0) => /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);

export function initInstall(onChange) {
  const ua = navigator.userAgent;
  install.platform = isIOS(ua, navigator.platform, navigator.maxTouchPoints) ? 'ios' : /Android/.test(ua) ? 'android' : null;
  install.standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  try {
    install.dismissedUntil = Number(localStorage.getItem(KEY)) || 0;
  } catch {
    // Storage blocked: ask again next time.
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own card instead of Chrome's bar
    deferred = e;
    install.canPrompt = true;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    install.canPrompt = false;
    install.installed = true;
    onChange();
  });
}

export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  install.canPrompt = false;
  e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') install.installed = true;
  return outcome === 'accepted';
}

export function snoozeInstall(now = Date.now()) {
  install.dismissedUntil = now + SNOOZE_DAYS * 86400000;
  try {
    localStorage.setItem(KEY, String(install.dismissedUntil));
  } catch {
    // Storage blocked: the card comes back next visit.
  }
}

// Offer it on a phone, in the browser, unless snoozed. Android only once
// Chrome says the planner can be installed.
export const offerInstall = (i, now = Date.now()) =>
  Boolean(i?.platform && !i.standalone && !i.installed && now >= i.dismissedUntil && (i.platform === 'ios' || i.canPrompt));
