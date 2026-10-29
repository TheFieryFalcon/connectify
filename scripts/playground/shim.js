/**
 * Connectify playground: the few extension APIs content scripts use (storage.local, getManifest, getURL),
 * with storage.local kept in localStorage under one key so it survives reloads like the real thing.
 */
(() => {
  'use strict';

  const KEY = 'connectify-playground:extension-storage';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = data => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };
  const done = (cb, value) => { if (typeof cb === 'function') setTimeout(() => cb(value), 0); return Promise.resolve(value); };

  const local = {
    get(keys, cb) {
      const data = read();
      let out = {};
      if (keys === null || keys === undefined) out = data;
      else if (typeof keys === 'string') { if (keys in data) out[keys] = data[keys]; }
      else if (Array.isArray(keys)) keys.forEach(k => { if (k in data) out[k] = data[k]; });
      else Object.entries(keys).forEach(([k, fallback]) => { out[k] = k in data ? data[k] : fallback; });
      return done(cb, out);
    },
    set(items, cb) { write({ ...read(), ...items }); return done(cb); },
    remove(keys, cb) {
      const data = read();
      [].concat(keys).forEach(k => delete data[k]);
      write(data);
      return done(cb);
    },
    clear(cb) { write({}); return done(cb); }
  };

  window.chrome = {
    storage: { local, onChanged: { addListener() {}, removeListener() {} } },
    runtime: {
      id: 'connectify-playground',
      getManifest: () => window.__playgroundManifest || { version: '0.0.0', permissions: [] },
      getURL: p => `/${String(p || '').replace(/^\//, '')}`,
      onMessage: { addListener() {}, removeListener() {} },
      sendMessage() { return Promise.resolve(); }
    }
  };
  window.ConnectifyPlaygroundStorageKey = KEY;
})();
