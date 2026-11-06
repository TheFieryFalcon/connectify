/**
 * Connectify Storage Rename (document_start, every Connect page, before theme-boot.js): Connectify once kept
 * much of its data under its old name, `connectea:` (themes, wallpaper, task types, week overrides,
 * categories, calibration, cohort sizes). Every key now reads `connectify:`, so this moves the student's saved
 * keys to their new names once per browser, in localStorage and in extension storage, before anything reads
 * them. Backups and archived years written before the rename go through `key()` as they are read.
 * Exposes window.ConnectifyStorageRename.
 */
(() => {
  'use strict';

  if (window.ConnectifyStorageRename) return;

  const LOCAL_DONE = 'connectify:storage_renamed';
  const EXT_DONE = 'connectify:storage_renamed_ext';
  const BOOT = 'connectify:theme_boot';

  // A key's old name, at its start or after a per-student prefix (`connectify:user:<account>:`)
  const OLD_KEY = /(^|:)connectea:/g;
  const key = k => (typeof k === 'string' ? k.replace(OLD_KEY, '$1connectify:') : k);
  const isOld = k => typeof k === 'string' && key(k) !== k;

  // Baselines already had current `connectify:` keys beside the old ones, so a current one is kept; every
  // other old key was the one in use and wins over a leftover of the same new name
  const keepsCurrent = k => /(^|:)connectify:baselines?:/.test(k);

  function renameLocal(store) {
    const old = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (isOld(k)) old.push(k);
    }
    for (const k of old) {
      const next = key(k);
      if (store.getItem(next) === null || !keepsCurrent(next)) store.setItem(next, store.getItem(k));
      store.removeItem(k);
    }
    // The theme snapshot names the attributes it stamps back
    const boot = store.getItem(BOOT);
    if (boot && boot.includes('data-connectea-')) store.setItem(BOOT, boot.split('data-connectea-').join('data-connectify-'));
  }

  function runLocal() {
    try {
      if (localStorage.getItem(LOCAL_DONE)) return;
      renameLocal(localStorage);
      localStorage.setItem(LOCAL_DONE, 'true');
    } catch (e) {
      console.warn('Connectify: could not rename saved keys', e);
    }
    try { renameLocal(sessionStorage); } catch {}
  }

  const extensionStorage = () => {
    try {
      if (typeof browser !== 'undefined' && browser?.storage?.local) return { area: browser.storage.local, promised: true };
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) return { area: chrome.storage.local, promised: false };
    } catch {}
    return null;
  };

  const call = (api, method, arg) => (api.promised
    ? api.area[method](arg)
    : new Promise((resolve, reject) => api.area[method](arg, result => {
      const err = chrome.runtime?.lastError;
      if (err) reject(err); else resolve(result);
    })));

  async function runExtension() {
    const api = extensionStorage();
    if (!api) return;
    try {
      const all = await call(api, 'get', null) || {};
      if (all[EXT_DONE]) return;
      const writes = {};
      const old = Object.keys(all).filter(isOld);
      for (const k of old) {
        const next = key(k);
        if (!(next in all) || !keepsCurrent(next)) writes[next] = all[k];
      }
      writes[EXT_DONE] = true;
      await call(api, 'set', writes);
      if (old.length) await call(api, 'remove', old);
    } catch (e) {
      console.warn('Connectify: could not rename extension storage keys', e);
    }
  }

  runLocal();
  const ready = runExtension();

  window.ConnectifyStorageRename = { key, isOld, ready };
})();
