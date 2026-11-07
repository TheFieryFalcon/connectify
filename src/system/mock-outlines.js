/**
 * Connectify: mock outlines, for testing while Connect shows none (exam weeks)
 *
 * While localStorage holds connectify:mock_outlines ({ records }: outline records in outline-api.js's shape), the
 * extension runs as a separate student: ConnectifyUtils.liveAccountKey() carries suffix() (`~mock`), so every
 * per-student key (caches, class registry, year snapshot, goals, overrides, archive) is the mock account's, and
 * outline-api.js serves these records instead of fetching Connect's. The student's own account is never read or
 * written, so their class registry never sees the mock classes and Connect's real outlines can never start a new
 * year from them. A toast on the outlines page says so, with Exit (removes the key and reloads). Global settings
 * (theme, categories, Settings checkboxes) are shared. Loaded right after past-year-mode.js, before utils.js.
 * Exposes window.ConnectifyMockOutlines.
 */
(() => {
  'use strict';
  if (window.ConnectifyMockOutlines) return;

  const KEY = 'connectify:mock_outlines';
  const SUFFIX = '~mock';

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return Array.isArray(saved?.records) ? saved : null;
    } catch {
      return null;
    }
  }

  // Read once per page: switching mid-page would split one page's keys across two accounts
  const state = read();
  if (state && typeof document !== 'undefined') document.documentElement?.setAttribute('data-cx-mock', '');

  const active = () => Boolean(state);
  const suffix = () => (state ? SUFFIX : '');
  /** The mock records as saved now (a result released from the console since load is read on the next load). */
  const records = () => read()?.records || [];

  function exit() {
    try { localStorage.removeItem(KEY); } catch {}
    location.reload();
  }

  function notify() {
    if (!state || !window.ConnectifyUtils?.isOutlinesPage?.()) return;
    window.ConnectifyNotifications?.show?.({
      id: 'connectify-mock-outlines',
      type: 'info',
      title: 'Mock Outlines',
      message: 'Connectify is showing mock outlines. Your own data is untouched.',
      duration: 0,
      actions: [{ text: 'Exit Mock Outlines', type: 'primary', onClick: exit }]
    });
  }
  if (state) setTimeout(notify, 3000);

  window.ConnectifyMockOutlines = { KEY, SUFFIX, active, suffix, records, exit };
})();
