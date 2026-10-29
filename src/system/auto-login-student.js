/**
 * Connectify Auto-login: Student sign-in
 *
 * Connect's sign-in page first asks who is signing in (Staff / Parent / Student). With Auto-login on
 * (`cx-autologin-enabled`, the checkbox on the DET sign-in page) it presses Student, also after the session
 * expired, unless the student logged out or a login was attempted in the last 30s. The logout flag is left
 * for auto-login.js, which shows why it paused and clears it.
 */
(() => {
  'use strict';

  if (window.__connectifyAutoLoginStudent) return;
  window.__connectifyAutoLoginStudent = true;

  const api = globalThis.browser?.storage ? globalThis.browser : (globalThis.chrome?.storage ? globalThis.chrome : null);
  if (!api?.storage?.local) return;

  const KEYS = ['cx-autologin-enabled', 'cx-manual-logout', 'cx-last-autologin'];
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

  const isPaused = flags => flags['cx-manual-logout'] === true ||
    Date.now() - Number(flags['cx-last-autologin'] || 0) < 30000;

  read().then(flags => {
    if (!flags || flags['cx-autologin-enabled'] === false || isPaused(flags)) return;
    document.querySelector(STUDENT)?.click();
  });
})();
