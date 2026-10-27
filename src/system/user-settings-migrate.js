/**
 * Connectify Per-User Settings Migration
 *
 * Settings that belong to one student were once shared by everyone signing in on the browser: task type
 * overrides, class categories, week overrides, the Semester 1 calibration (connectea:preferences) and the
 * Weaknesses subject filter. Once per browser, the first signed-in page moves them to that student's own
 * keys (ConnectifyUtils.userKey: connectify:user:<account>: + the old key), never overwriting one already
 * there. Runs right after utils.js, before anything reads them. Exposes window.ConnectifyUserSettingsMigrate.
 */
(() => {
  'use strict';
  if (window.ConnectifyUserSettingsMigrate) return;

  const DONE_KEY = 'connectify:user_settings_migrated';
  const KEYS = ['connectea:task_type_overrides', 'connectea:preferences', 'connectify:weakness_disabled_subjects'];
  const PREFIXES = ['connectea:class_categories:', 'connectea:time_override:', 'connectify:time_override:'];

  const isUserSetting = key => KEYS.includes(key) || PREFIXES.some(prefix => key.startsWith(prefix));

  /** Moves every shared setting to the signed-in student's keys; false when no student is signed in. */
  function run() {
    const utils = window.ConnectifyUtils;
    try {
      if (localStorage.getItem(DONE_KEY)) return true;
      if (!utils.signedInUserId()) return false;
      for (const key of utils.storageKeys(isUserSetting)) {
        const target = utils.userKey(key);
        if (localStorage.getItem(target) === null) localStorage.setItem(target, localStorage.getItem(key));
        localStorage.removeItem(key);
      }
      localStorage.setItem(DONE_KEY, '1');
      return true;
    } catch (e) {
      console.warn('Connectify could not move settings to the signed-in user:', e);
      return false;
    }
  }

  window.ConnectifyUserSettingsMigrate = { run, isUserSetting };
  run();
})();
