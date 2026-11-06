/**
 * Connectify Past Years: the year archive
 *
 * Connect never shows last year's marks again once a new year starts, so the archive the new-year rollover writes
 * (year-rollover.js) is their only copy: connectify:year_archive:<account>, a list of years, each { classNames,
 * averages, subjects, grades, classSemesters, goals, records (Connect's outline records at the year's end),
 * settings (that year's per-student keys, {account}-templated), year, archivedAt }. It is kept in localStorage and in
 * extension storage, which a large wallpaper never fills and clearing the site's data never empties; read() merges
 * the two (ready() reads extension storage once). One entry per class set, the one with more tasks kept, the last
 * MAX_YEARS. years() lists those that are not this year's classes, with their labels ("Year 11, 2026").
 * Always the signed-in student's own archive, also while a past year is viewed. Exposes window.ConnectifyYearArchive.
 */
(() => {
  'use strict';
  if (window.ConnectifyYearArchive) return;

  const PREFIX = 'connectify:year_archive:';
  const MAX_YEARS = 3;
  const live = () => window.ConnectifyUtils.liveAccountKey();
  const key = () => `${PREFIX}${live()}`;
  const storageApi = () => (typeof browser !== 'undefined' && browser?.storage ? browser : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null));
  const readJson = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

  const listOf = raw => {
    let value = raw;
    if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch { value = null; } }
    return Array.isArray(value) ? value.filter(e => e && Array.isArray(e.classNames) && e.classNames.length) : [];
  };

  const signature = entry => [...entry.classNames].sort().join('|');
  const recordTasks = entry => (Array.isArray(entry.records) ? entry.records : [])
    .reduce((n, r) => n + (r?.outlines || []).reduce((m, o) => m + (o?.tasks?.length || 0), 0), 0);
  const subjectTasks = entry => Object.values(entry.subjects || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
  const taskCount = entry => recordTasks(entry) || subjectTasks(entry);
  const isEmpty = v => v === null || v === undefined || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v).length);

  /** One entry per class set, oldest first, the last MAX_YEARS: the copy with more tasks wins, filled in from the other. */
  function merge(...lists) {
    const bySignature = new Map();
    for (const entry of lists.flatMap(listOf)) {
      const sig = signature(entry);
      const kept = bySignature.get(sig);
      if (!kept) { bySignature.set(sig, entry); continue; }
      const richer = taskCount(entry) > taskCount(kept) || (taskCount(entry) === taskCount(kept) && (entry.archivedAt || 0) > (kept.archivedAt || 0));
      const [winner, other] = richer ? [entry, kept] : [kept, entry];
      bySignature.set(sig, { ...other, ...Object.fromEntries(Object.entries(winner).filter(([, v]) => !isEmpty(v))) });
    }
    return [...bySignature.values()].sort((a, b) => (a.archivedAt || 0) - (b.archivedAt || 0)).slice(-MAX_YEARS);
  }

  let extList = null;
  let readyPromise = null;
  /** Reads the extension storage copy once; resolves when read() includes it. */
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise(resolve => {
      let done = false;
      const finish = res => {
        if (done) return;
        done = true;
        extList = listOf(res?.[key()]);
        resolve();
        window.dispatchEvent(new CustomEvent('connectify-archive-ready'));
      };
      const api = storageApi();
      if (!api?.storage?.local) { finish(null); return; }
      try {
        const p = api.storage.local.get([key()], finish);
        if (p && typeof p.then === 'function') p.then(finish, () => finish(null));
      } catch { finish(null); }
    });
    return readyPromise;
  }

  // The launcher asks every 1.5s whether a past year exists: the stored list is parsed again only when it changed
  let memo = { raw: undefined, ext: undefined, list: [] };
  function read() {
    let raw = null;
    try { raw = localStorage.getItem(key()); } catch {}
    if (raw !== memo.raw || extList !== memo.ext) memo = { raw, ext: extList, list: merge(listOf(raw), extList || []) };
    return memo.list;
  }

  /** Stores the list (merged with what is stored): whole in extension storage, in localStorage as far as it fits. */
  function write(list) {
    const merged = merge(read(), list);
    try {
      localStorage.setItem(key(), JSON.stringify(merged));
    } catch {
      // Over quota (a large wallpaper shares it): extension storage keeps the task lists, this copy what fits
      try { localStorage.setItem(key(), JSON.stringify(merged.map(e => ({ ...e, subjects: {}, records: null, settings: null })))); } catch {}
    }
    // Merged with the extension copy once it is read, so a copy short of task lists never replaces a whole one
    const storeExtension = () => {
      if (!storageApi()?.storage?.local) return;
      extList = merge(extList || [], merged);
      try {
        const p = storageApi()?.storage?.local?.set({ [key()]: JSON.stringify(extList) });
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
    };
    if (extList === null) ready().then(storeExtension); else storeExtension();
    return merged;
  }

  /** Highest calendar year and school year level named in class titles (null when absent). */
  function yearMarker(names) {
    let calendar = null;
    let level = null;
    for (const name of names) {
      for (const m of String(name).matchAll(/\b(20\d{2})\b/g)) calendar = Math.max(calendar ?? 0, Number(m[1]));
      const lv = String(name).match(/\byear\s*(\d{1,2})\b/i) || String(name).match(/^(\d{1,2})\s/);
      if (lv) level = Math.max(level ?? 0, Number(lv[1]));
    }
    return { calendar, level };
  }

  /** The calendar year an entry is: saved since Past Years, else named in its classes, else when it was archived (January to June: the year before). */
  function yearOf(entry) {
    if (Number.isInteger(entry?.year)) return entry.year;
    const named = yearMarker(entry?.classNames || []).calendar;
    if (named) return named;
    const at = new Date(entry?.archivedAt || Date.now());
    return at.getMonth() < 6 ? at.getFullYear() - 1 : at.getFullYear();
  }

  const label = entry => {
    const { level } = yearMarker(entry?.classNames || []);
    return level ? `Year ${level}, ${yearOf(entry)}` : String(yearOf(entry));
  };
  const idOf = entry => Number(entry?.archivedAt || 0).toString(36);

  // This year's classes: the class registry and the year snapshot, both the student's own (never a viewed year's copy)
  function thisYearClasses() {
    const names = new Set(Object.keys(readJson(`connectify:class_semesters:${live()}`) || {}));
    for (const name of readJson(`connectify:year_snapshot:${live()}`)?.classNames || []) names.add(name);
    return names;
  }

  /** Past years, newest first: { id, label, year, entry }. An entry sharing a class with this year is this year (a backup's copy). */
  function years() {
    const current = thisYearClasses();
    return read().filter(e => !e.classNames.some(n => current.has(n))).reverse()
      .map(entry => ({ id: idOf(entry), label: label(entry), year: yearOf(entry), entry }));
  }

  const find = id => years().find(y => y.id === id) || null;

  window.ConnectifyYearArchive = { PREFIX, MAX_YEARS, key, ready, read, write, merge, taskCount, yearMarker, yearOf, label, idOf, years, find, thisYearClasses };
  ready();
})();
