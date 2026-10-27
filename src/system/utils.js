/**
 * Connectify Shared Utilities
 *
 * Text normalisation, HTML escaping, the signed-in user's account key, localStorage key scanning, legacy baseline key resolution,
 * Progress Graph week overrides, the outlines page check and the chart resync request to the main-world bridge
 * shared by every content script. Loaded first in the assessment outlines pipeline.
 * Exposes window.ConnectifyUtils.
 */
(() => {
  'use strict';
  if (window.ConnectifyUtils) return;

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  // Connect's own menu opens the outlines with ?coisp=<account>, the Connectify shortcut without it,
  // so the account is remembered: every per-student key stays the same however the page was opened
  const ACCOUNT_STORE = 'connectify:account';
  let knownAccount;

  function rememberedAccount() {
    if (knownAccount === undefined) {
      try { knownAccount = localStorage.getItem(ACCOUNT_STORE) || null; } catch { knownAccount = null; }
    }
    return knownAccount;
  }

  /** Copies what was saved under the 'current' placeholder to the first real account seen (never overwriting). */
  function adoptPlaceholderKeys(account) {
    for (const key of storageKeys(k => /^(connectify|connectea):.*:current(:|$)/.test(k))) {
      const target = key.replace(/:current(?=:|$)/, `:${account}`);
      try {
        if (localStorage.getItem(target) === null) localStorage.setItem(target, localStorage.getItem(key));
      } catch {}
    }
  }

  function rememberAccount(account) {
    const previous = rememberedAccount();
    if (previous === account) return;
    knownAccount = account;
    try { localStorage.setItem(ACCOUNT_STORE, account); } catch {}
    if (!previous) adoptPlaceholderKeys(account);
  }

  // Connect (Liferay) names the signed-in user in an inline script (themeDisplay's getUserId), so each user
  // keeps an account of their own: someone else signing in on this browser never sees the last user's caches
  const USERS_STORE = 'connectify:accounts';
  const USER_ID = /getUserId\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*["'](\d+)["']/;
  const SIGNED_IN = /isSignedIn\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*(?:!0|true)\b/;
  let signedInUser;
  let userAccount = null;

  /** The signed-in user's Connect id, or null (guest pages, or before Connect's scripts are parsed). */
  function signedInUserId() {
    if (signedInUser !== undefined) return signedInUser;
    let found = null;
    let parsed = true;
    try {
      parsed = document.readyState !== 'loading';
      for (const script of document.scripts) {
        if (script.src) continue;
        const text = script.textContent || '';
        if (!text.includes('getUserId')) continue;
        const match = text.match(USER_ID);
        if (match) { found = SIGNED_IN.test(text) ? match[1] : null; break; }
      }
    } catch {}
    if (found || parsed) signedInUser = found;
    return found;
  }

  function readUsers() {
    try {
      const users = JSON.parse(localStorage.getItem(USERS_STORE) || '{}');
      return users && typeof users === 'object' && !Array.isArray(users) ? users : {};
    } catch { return {}; }
  }

  /**
   * The signed-in user's account, fixed the first time they are seen: Connect's ?coisp=, else the account
   * in use before users were told apart (only for the first user, since it is theirs), else 'user<id>'.
   */
  function accountForUser(user, coisp) {
    if (userAccount) return userAccount;
    const users = readUsers();
    let account = users[user];
    if (!account) {
      const legacy = Object.keys(users).length ? null : rememberedAccount();
      account = coisp || legacy || `user${user}`;
      users[user] = account;
      try { localStorage.setItem(USERS_STORE, JSON.stringify(users)); } catch {}
    }
    userAccount = account;
    rememberAccount(account);
    return account;
  }

  /**
   * The student account: the signed-in user's own (see accountForUser); on a page that does not name its
   * user, ?coisp=... (class ids excluded), else the last account seen, else 'current'.
   */
  function accountKey() {
    let coisp = null;
    try { coisp = new URL(location.href).searchParams.get('coisp'); } catch {}
    if (coisp && /^DomainSchool/i.test(coisp)) coisp = null;
    const user = signedInUserId();
    if (user) return accountForUser(user, coisp);
    if (coisp) {
      rememberAccount(coisp);
      return coisp;
    }
    return rememberedAccount() || 'current';
  }

  /** Returns every localStorage key accepted by predicate (keys are collected before any removal). */
  function storageKeys(predicate) {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && predicate(key)) keys.push(key);
      }
    } catch {}
    return keys;
  }

  /** Removes every localStorage key accepted by predicate; returns how many were removed. */
  function removeStorageKeys(predicate) {
    const keys = storageKeys(predicate);
    for (const key of keys) {
      try { localStorage.removeItem(key); } catch {}
    }
    return keys.length;
  }

  // Every prefix baselines have ever been stored under (singular is current, plural is legacy)
  const BASELINE_PREFIXES = ['connectea:baseline:', 'connectea:baselines:', 'connectify:baseline:', 'connectify:baselines:'];

  /**
   * Candidate storage keys for a baseline kind ('types' or 'subjects'), oldest first so that
   * merging them in order lets the current key (connectify:baseline:<kind>:<account>) win.
   */
  function baselineKeys(kind, account) {
    return [
      `connectea:baseline:${kind}`,
      `connectea:baselines:${kind}`,
      `connectify:baseline:${kind}`,
      `connectify:baselines:${kind}`,
      `connectea:baseline:${kind}:${account}`,
      `connectea:baselines:${kind}:${account}`,
      `connectify:baselines:${kind}:${account}`,
      `connectify:baseline:${kind}:${account}`
    ];
  }

  const isBaselineKey = key => BASELINE_PREFIXES.some(prefix => key.startsWith(prefix));

  /**
   * Converts a Progress Graph week override to the internal order (12-week terms, as formatTimestamp reads it).
   * The editor saves "w17": school week 17 of the year through the term calendar, as the Export numbers
   * term starts (Early Easter: Term 2 starts at Week 10). Bare numbers were saved before Early Easter was
   * known and are the same school week of the year ("17" reads as "w17"); "t2w7" names a term and week.
   */
  function customWeekOrder(value) {
    const str = String(value ?? '').trim();
    const tw = str.match(/t(?:erm)?\s*(\d+)\s*[,;]?\s*w(?:eek)?\s*(\d+)/i);
    if (tw) return (Number(tw[1]) - 1) * 12 + Number(tw[2]);
    const school = str.match(/^w?(\d+)$/i);
    if (!school) return null;
    const n = Number(school[1]);
    if (n <= 0) return null;
    return window.ConnectifySchoolTerms?.weekOrder(n) ?? Math.floor((n - 1) / 10) * 12 + ((n - 1) % 10) + 1;
  }

  /** First saved week override for any subject and task id/name pair (ids in priority order), or null. */
  function readTimeOverride(subjects, ids) {
    for (const id of ids) {
      if (!id) continue;
      for (const subject of subjects) {
        if (!subject) continue;
        for (const prefix of ['connectea', 'connectify']) {
          try {
            const value = localStorage.getItem(`${prefix}:time_override:${subject}:${id}`);
            if (value !== null && value !== '') return value;
          } catch {}
        }
      }
    }
    return null;
  }

  /**
   * Asks the main-world bridge (data.js) to re-read every chart's boxplot. The bridge lives in the page's
   * world, so a DOM event is the only way to reach it from here.
   */
  const syncCharts = () => document.dispatchEvent(new CustomEvent('connectify-sync-charts'));

  // The sidebar runs on every Connect page; only the outlines page holds class cards to read
  const OUTLINES_URL = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
  function isOutlinesPage() {
    try { return new URL(location.href).pathname.startsWith(new URL(OUTLINES_URL).pathname); } catch { return true; }
  }

  /** Semester (1 or 2) named in a subject card title; 1 when the title names none. */
  function cardSemester(title) {
    const match = String(title || '').match(/\bSem(?:ester)?\s*([12])\b/i);
    return match ? Number(match[1]) : 1;
  }
  window.ConnectifyDataSyncCharts = syncCharts;

  window.ConnectifyUtils = {
    normalize, escapeHtml, accountKey, signedInUserId, storageKeys, removeStorageKeys, BASELINE_PREFIXES, baselineKeys, isBaselineKey,
    customWeekOrder, readTimeOverride, syncCharts, cardSemester, OUTLINES_URL, isOutlinesPage
  };
})();
