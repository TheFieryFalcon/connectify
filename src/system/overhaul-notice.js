/**
 * Connectify: Connect overhaul notice (one time, 3.3.0)
 *
 * Connect rebuilt its Assessment Outlines in October 2026, and from 3.3.0 Connectify reads every class from
 * Connect's API (outline-api.js). With "Show this semester's classes only" on, only one semester's classes
 * would reach the class registry, so semester detection could not fill its cache. The first time a student
 * upgrading from an earlier version (connectify:seen_version, read before update-notice.js records this
 * one) opens Assessment Outlines, the option is turned off once and a popup explains the change and, when
 * the option was on, that it can be turned back on in Settings. Runs before semester-filter.js reads the
 * option. Fresh installs only record that it ran (connectify:overhaul_notice). Exposes
 * window.ConnectifyOverhaulNotice.
 */
(() => {
  'use strict';

  if (window.ConnectifyOverhaulNotice) return;

  const DONE_KEY = 'connectify:overhaul_notice';
  const FILTER_KEY = 'connectify:semester_filter';
  const SEEN_KEY = 'connectify:seen_version';
  const OVERHAUL_VERSION = '3.3.0';

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

  /** Whether version a is older than b ("3.2.10" < "3.3.0"). */
  function isOlder(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
    }
    return false;
  }

  const filterWasOn = () => {
    try { return JSON.parse(read(FILTER_KEY) || 'null')?.enabled === true; } catch { return false; }
  };

  /**
   * Once per profile on the outlines page: an upgrade from before 3.3.0 turns the semester filter off and
   * returns { filterWasOn } for the popup; otherwise (fresh install, already run) null.
   */
  function migrate() {
    if (!window.ConnectifyUtils?.isOutlinesPage?.() || window.ConnectifyThemeAuth?.isAuthDisabled?.()) return null;
    if (read(DONE_KEY)) return null;
    write(DONE_KEY, 'true');
    const seen = read(SEEN_KEY);
    if (!seen || !isOlder(seen, OVERHAUL_VERSION)) return null;
    const wasOn = filterWasOn();
    if (wasOn) write(FILTER_KEY, JSON.stringify({ enabled: false }));
    return { filterWasOn: wasOn };
  }

  function openSettings() {
    const toggle = document.getElementById('connectify-categories-toggle');
    if (toggle) toggle.click();
    else window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
  }

  /** The popup (the shared solid dialog, goal-modal.js). */
  function show({ filterWasOn: wasOn }) {
    const modal = window.ConnectifyGoalModal;
    if (!modal?.open) return false;
    modal.open({
      id: 'cx-overhaul-notice',
      title: 'Connect has changed',
      build(body, close) {
        const p = text => modal.el('p', 'cx-overhaul-text', text);
        body.append(p('Connect has rebuilt its Assessment Outlines page. Connectify now reads your outlines straight from Connect and shows them in the layout you know, with every Connectify feature.'));
        if (wasOn) {
          body.append(p('"Show this semester\'s classes only" has been turned off once, so Connectify can learn which semester each class belongs to. Turn it back on in Settings when you want it.'));
        }
        const actions = modal.el('div', 'cx-goal-dialog-actions');
        if (wasOn) {
          const settings = modal.el('button', 'cx-goal-cancel', 'Open Settings');
          settings.type = 'button';
          settings.addEventListener('click', () => { close(); openSettings(); });
          actions.append(settings);
        }
        const ok = modal.el('button', 'cx-goal-confirm', 'Got it');
        ok.type = 'button';
        ok.addEventListener('click', close);
        actions.append(ok);
        body.append(actions);
      }
    });
    return true;
  }

  const pending = migrate();
  // Shown once the outlines are drawn (legacy-outlines.js), or 8s on, so it rarely covers a half-built page
  if (pending) {
    const startedAt = Date.now();
    const drawn = () => document.querySelector('#cx-legacy-outlines .eds-c-tile');
    const waitAndShow = () => {
      if (!document.body || (!drawn() && Date.now() - startedAt < 8000)) { setTimeout(waitAndShow, 250); return; }
      setTimeout(() => show(pending), 400);
    };
    waitAndShow();
  }

  window.ConnectifyOverhaulNotice = { DONE_KEY, OVERHAUL_VERSION, isOlder, migrate, show };
})();
