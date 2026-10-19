/**
 * Connectify: update notice
 *
 * After the extension updates to a newer version, shows one "Connectify updated" toast with a
 * "What's new" button that opens the changelog (newest release first). The version last seen is kept
 * at connectify:seen_version; a fresh install only records it, and a downgrade never notifies.
 * Exposes window.ConnectifyUpdateNotice.
 */
(() => {
  'use strict';

  if (window.ConnectifyUpdateNotice) return;

  const KEY = 'connectify:seen_version';
  const CHANGELOG_URL = 'https://github.com/TheFieryFalcon/connectify/blob/main/CHANGELOG.md';

  const currentVersion = () => {
    try {
      return (globalThis.browser || globalThis.chrome)?.runtime?.getManifest?.()?.version || null;
    } catch {
      return null; // the extension was reloaded under this page
    }
  };

  /** Negative, zero or positive as version a is older than, equal to or newer than b ("3.2.10" > "3.2.9"). */
  function compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff) return diff;
    }
    return 0;
  }

  function openChangelog() {
    window.open(CHANGELOG_URL, '_blank', 'noopener');
  }

  /** Shows the notice once per newer version; returns whether it was shown. */
  function check() {
    const version = currentVersion();
    const notices = window.ConnectifyNotifications;
    if (!version || !notices?.show) return false;
    let seen = null;
    try { seen = localStorage.getItem(KEY); } catch {}
    try { localStorage.setItem(KEY, version); } catch {}
    if (!seen || compareVersions(version, seen) <= 0) return false;

    notices.show({
      id: 'cx-update-notice',
      type: 'info',
      icon: '✨',
      title: `Connectify updated to ${version}`,
      message: `You were on ${seen}. See what's new in this version.`,
      duration: 0,
      actions: [
        { text: 'Dismiss', type: 'secondary', onClick: ({ close }) => close() },
        { text: "What's new", type: 'accent', onClick: ({ close }) => { openChangelog(); close(); } }
      ]
    });
    return true;
  }

  // After the page's own startup work, so the toast does not compete with it
  setTimeout(check, 3000);

  window.ConnectifyUpdateNotice = { KEY, CHANGELOG_URL, check, compareVersions };
})();
