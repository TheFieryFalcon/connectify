/**
 * Connectify Auto-login: Student sign-in
 *
 * Connect's sign-in page first asks who is signing in (Staff / Parent / Student). With Auto-login on
 * (`cx-autologin-enabled`, the checkbox on the DET sign-in page) it presses Student, unless auto-login is
 * paused: a manual logout, an expired session or a login in the last 30s. The flags are left for
 * auto-login.js, which shows why it paused and clears them.
 */
(() => {
  'use strict';

  if (window.__connectifyAutoLoginStudent) return;
  window.__connectifyAutoLoginStudent = true;

  const api = globalThis.browser?.storage ? globalThis.browser : (globalThis.chrome?.storage ? globalThis.chrome : null);
  if (!api?.storage?.local) return;

  const KEYS = ['cx-autologin-enabled', 'cx-manual-logout', 'cx-session-expired', 'cx-last-autologin'];
  const STUDENT = 'a.login-btn--student, a[href$="/login/student"]';

  // Chrome answers the callback, Firefox's browser.* the promise: the first answer wins
  const read = () => new Promise(resolve => {
    try {
      const p = api.storage.local.get(KEYS, resolve);
      if (p && typeof p.then === 'function') p.then(resolve, () => resolve({}));
    } catch {
      resolve({});
    }
  });

  function isPaused(flags) {
    const bodyText = document.body?.innerText || '';
    return flags['cx-manual-logout'] === true ||
      flags['cx-session-expired'] === true ||
      /timeout|expired|logout|inactivity|reason=/i.test(location.href) ||
      /session\s*(has\s*)?(expired|timed\s*out)|logged\s*out\s*due\s*to\s*inactivity|inactivity\s*timeout|session\s*timeout/i.test(bodyText) ||
      Date.now() - Number(flags['cx-last-autologin'] || 0) < 30000;
  }

  read().then(flags => {
    if (!flags || flags['cx-autologin-enabled'] === false || isPaused(flags)) return;
    document.querySelector(STUDENT)?.click();
  });
})();
